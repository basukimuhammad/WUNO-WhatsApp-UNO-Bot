import { randomBytes } from "node:crypto";
import { MessageMedia, type Client } from "whatsapp-web.js";

const BASE = "https://spotsaver.net";
const YTM_API = "https://music.youtube.com/youtubei/v1/search";
const YTM_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const YTM_VERSION = "1.20260915.14.00";
const Y2MATE_API = "https://eta.etacloud.org";
const Y2MATE_KEY = "c6a644f406b57d0dd83837c868a7482e";
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36";
const SESSION_TTL = 15 * 60 * 1000;

type Track = { id:string|null; title:string; artist:string; album:string; duration:string; thumbnail:string|null; spotifyUrl:string|null; audioUrl?:string|null };
type Session = { client:Client; chatId:string; createdAt:number; tracks:Track[] };
const sessions=new Map<string,Session>();

async function json(url:string, init?:RequestInit, timeoutMs=30000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{
      ...init,
      signal:controller.signal,
      headers:{
        "User-Agent":UA,
        "Accept":"application/json, text/plain, */*",
        "Accept-Language":"id-ID,id;q=0.9,en;q=0.8",
        "Referer":BASE+"/id/",
        "Origin":BASE,
        ...(init?.headers||{})
      }
    });
    const t=await r.text();
    let d:any;try{d=JSON.parse(t)}catch{d=t}
    if(!r.ok)throw new Error("HTTP "+r.status+(typeof d==="string"&&d?": "+d.slice(0,120):""));
    return d;
  }catch(error){
    if(error instanceof Error&&error.name==="AbortError")throw new Error("Permintaan timeout. Server Spotify sedang lambat.");
    throw error;
  }finally{clearTimeout(timer)}
}
function track(t:any):Track{return{id:t?.id??null,title:t?.title||"Unknown Title",artist:t?.artist||"Unknown Artist",album:t?.album||"Unknown Album",duration:t?.duration||"0:00",thumbnail:t?.thumbnail||null,spotifyUrl:t?.id?"https://open.spotify.com/track/"+t.id:null,audioUrl:null}}
async function searchSpotify(q:string){
  const d:any=await json(BASE+"/api/spotify?q="+encodeURIComponent(q));
  if(!d?.items)throw new Error("Search Spotify gagal: respons tidak berisi items");
  return d.items.map(track).filter((x:Track)=>x.title);
}
async function infoSpotify(url:string){const d:any=await json(BASE+"/api/spotify?url="+encodeURIComponent(url));if(!d?.items)throw new Error("Info Spotify gagal");return d.items.map(track)}
async function ytmSearch(q:string){const body={context:{client:{clientName:"WEB_REMIX",clientVersion:YTM_VERSION,hl:"id",gl:"ID"}},query:q,params:"EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D"};const d:any=await json(YTM_API+"?key="+YTM_KEY+"&prettyPrint=false",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":YTM_KEY,"X-YouTube-Client-Name":"67","X-YouTube-Client-Version":YTM_VERSION,"Origin":"https://music.youtube.com","Referer":"https://music.youtube.com/"},body:JSON.stringify(body)});const out:any[]=[];for(const tab of d?.contents?.tabbedSearchResultsRenderer?.tabs||[]){for(const sec of tab?.tabRenderer?.content?.sectionListRenderer?.contents||[]){for(const item of sec?.musicShelfRenderer?.contents||[]){const x=item?.musicResponsiveListItemRenderer;if(!x)continue;const id=x?.playlistItemData?.videoId;const texts=(x.flexColumns||[]).map((c:any)=>(c?.musicResponsiveListItemFlexColumnRenderer?.text?.runs||[]).map((r:any)=>r.text).join("").trim()).filter(Boolean);if(id&&texts[0])out.push({videoId:id,title:texts[0],subtitle:texts[1]||""})}}}return out}
async function y2mGet(videoId:string){const auth:any=await json(Y2MATE_API+"/api/v1/auth?api_key="+Y2MATE_KEY+"&_="+Date.now());if(!auth?.key)throw new Error("y2mate auth gagal");const init:any=await json(Y2MATE_API+"/api/v1/init?_="+Date.now(),{headers:{Authorization:"Bearer "+auth.key}});if(!init?.convertURL)throw new Error("y2mate init gagal");let url=init.convertURL,progress:string|null=null;for(let i=0;i<20;i++){const u=new URL(url);u.searchParams.set("v",videoId);u.searchParams.set("f","mp3");u.searchParams.set("_",String(Date.now()));const d:any=await json(u.toString(),{headers:{Authorization:"Bearer "+auth.key}});if(d?.downloadURL)return String(d.downloadURL);if(d?.progressURL)progress=String(d.progressURL);if(d?.redirectURL){url=String(d.redirectURL);await new Promise(r=>setTimeout(r,1200));continue}break}if(progress)for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,3000));const d:any=await json(progress!);if(d?.downloadURL)return String(d.downloadURL);if(d?.redirectURL){const u:any=await json(String(d.redirectURL));if(u?.downloadURL)return String(u.downloadURL);if(u?.progressURL)progress=String(u.progressURL)}}throw new Error("Audio tidak tersedia")}
function get(token:string){const s=sessions.get(token);if(!s||Date.now()-s.createdAt>SESSION_TTL){sessions.delete(token);throw new Error("Sesi Spotify kedaluwarsa. Buka Spotify lagi.")}return s}
export function createSpotifySession(client:Client,chatId:string){const token=randomBytes(24).toString("hex");sessions.set(token,{client,chatId,createdAt:Date.now(),tracks:[]});return token}
export async function spotifySearch(token:string,q:string){const s=get(token);const v=q.trim();if(!v)throw new Error("Query kosong");s.tracks=(/^https?:\/\/open\.spotify\.com\//i.test(v)?await infoSpotify(v.split("?")[0]):await searchSpotify(v)).slice(0,12);return s.tracks.map(({audioUrl,...x})=>x)}
export async function resolveSpotifyTrack(token:string,index:number){const s=get(token),t=s.tracks[index];if(!t)throw new Error("Track tidak ditemukan");if(!t.audioUrl){const r=await ytmSearch(t.title+" "+t.artist);if(!r.length)throw new Error("Lagu tidak ditemukan");t.audioUrl=await y2mGet(r[0].videoId)}return t}
async function audio(token:string,index:number){const t=await resolveSpotifyTrack(token,index);const r=await fetch(t.audioUrl!,{headers:{"User-Agent":UA,"Referer":"https://y2mate.gs/"}});if(!r.ok)throw new Error("Audio gagal diambil");return{track:t,buffer:Buffer.from(await r.arrayBuffer())}}
export async function getSpotifyAudio(token:string,index:number){return audio(token,index)}
export async function sendSpotifyTrack(token:string,index:number){const s=get(token),{track,buffer}=await audio(token,index);const media=new MessageMedia("audio/mpeg",buffer.toString("base64"),track.title.replace(/[<>:"/\\|?*\x00-\x1F]/g," ").slice(0,120)+".mp3");await s.client.sendMessage(s.chatId,media);return{title:track.title}}
setInterval(()=>{const c=Date.now()-SESSION_TTL;for(const [k,v] of sessions)if(v.createdAt<c)sessions.delete(k)},60000).unref();
