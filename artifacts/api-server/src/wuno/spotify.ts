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
type Session = { client:Client; chatId:string; createdAt:number; tracks:Track[]; audioBuffers:Map<number,Buffer>; audioMimes:Map<number,string> };
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
  const d:any=await json(BASE+"/api/spotify?q="+encodeURIComponent(q),undefined,20000);
  if(!d?.items)throw new Error("SpotSaver tidak mengembalikan hasil");
  return d.items.map(track).filter((x:Track)=>x.title).slice(0,12);
}
async function infoSpotify(url:string){const d:any=await json(BASE+"/api/spotify?url="+encodeURIComponent(url));if(!d?.items)throw new Error("Info Spotify gagal");return d.items.map(track)}
async function ytmSearch(q:string){const body={context:{client:{clientName:"WEB_REMIX",clientVersion:YTM_VERSION,hl:"id",gl:"ID"}},query:q,params:"EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D"};const d:any=await json(YTM_API+"?key="+YTM_KEY+"&prettyPrint=false",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":YTM_KEY,"X-YouTube-Client-Name":"67","X-YouTube-Client-Version":YTM_VERSION,"Origin":"https://music.youtube.com","Referer":"https://music.youtube.com/"},body:JSON.stringify(body)});const out:any[]=[];for(const tab of d?.contents?.tabbedSearchResultsRenderer?.tabs||[]){for(const sec of tab?.tabRenderer?.content?.sectionListRenderer?.contents||[]){for(const item of sec?.musicShelfRenderer?.contents||[]){const x=item?.musicResponsiveListItemRenderer;if(!x)continue;const id=x?.playlistItemData?.videoId;const texts=(x.flexColumns||[]).map((c:any)=>(c?.musicResponsiveListItemFlexColumnRenderer?.text?.runs||[]).map((r:any)=>r.text).join("").trim()).filter(Boolean);if(id&&texts[0])out.push({videoId:id,title:texts[0],subtitle:texts[1]||""})}}}return out}
async function jsonExternal(url:string, init?:RequestInit, timeoutMs=30000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{...init,signal:controller.signal,headers:{
      "User-Agent":UA,
      "Accept":"application/json, text/plain, */*",
      ...(init?.headers||{})
    }});
    const text=await r.text();
    let data:any;
    try{data=JSON.parse(text)}catch{data=text}
    if(!r.ok)throw new Error("HTTP "+r.status);
    return data;
  }catch(error){
    if(error instanceof Error&&error.name==="AbortError")throw new Error("Request timeout");
    throw error;
  }finally{clearTimeout(timer)}
}

async function downloadResolved(url:string,referer:string){
  const r=await fetch(url,{headers:{
    "User-Agent":UA,
    "Accept":"*/*",
    "Referer":referer,
  }});
  if(!r.ok)throw new Error("Audio HTTP "+r.status);
  return{
    buffer:Buffer.from(await r.arrayBuffer()),
    mime:String(r.headers.get("content-type")||"audio/mpeg").split(";")[0],
  };
}

async function ytdlv2(videoUrl:string){
  const d:any=await jsonExternal(
    "https://api.nekolabs.my.id/downloader/youtube/v1?url="+encodeURIComponent(videoUrl)+"&format=mp3",
    undefined,
    45000
  );
  if(!d?.success||!d?.result?.downloadUrl)throw new Error("ytDownloader v2 gagal");
  return downloadResolved(String(d.result.downloadUrl),"https://api.nekolabs.my.id/");
}

async function ytdlv1(videoUrl:string){
  const d:any=await jsonExternal(
    "https://ytdlpyton.nvlgroup.my.id/download/audio?url="+encodeURIComponent(videoUrl)+"&mode=url",
    undefined,
    45000
  );
  if(!d?.download_url)throw new Error("ytDownloader v1 gagal");
  return downloadResolved(String(d.download_url),"https://ytdlpyton.nvlgroup.my.id/");
}

async function ytdlv3(videoUrl:string){
  const d:any=await jsonExternal(
    "https://anabot.my.id/api/download/ytmp4?url="+encodeURIComponent(videoUrl)+"&quality=720p&apikey=freeApikey",
    undefined,
    45000
  );
  const url=d?.data?.result?.urls;
  if(!url)throw new Error("ytDownloader v3 gagal");
  return downloadResolved(String(Array.isArray(url)?url[0]:url),"https://anabot.my.id/");
}

async function youtubeAudio(videoId:string){
  const videoUrl="https://www.youtube.com/watch?v="+videoId;
  const errors:string[]=[];

  try{
    const url=await convert1s(videoUrl);
    return await fetchDownload(url,"https://media.ytmp3.gg/");
  }catch(e){
    errors.push("convert1s: "+(e instanceof Error?e.message:String(e)));
  }

  try{
    const url=await ytmp3Mobi(videoId);
    return await fetchDownload(url,"https://ytmp3.mobi/");
  }catch(e){
    errors.push("ytmp3.mobi: "+(e instanceof Error?e.message:String(e)));
  }

  throw new Error("Semua downloader YouTube gagal: "+errors.join(" | "));
}
export async function resolveSpotifyTrack(token:string,index:number){
  const s=get(token),t=s.tracks[index];
  if(!t)throw new Error("Track tidak ditemukan");
  if(!t.audioUrl){
    const r=await ytmSearch(t.title+" "+t.artist);
    if(!r.length)throw new Error("Lagu tidak ditemukan");
    t.audioUrl="youtube://"+r[0].videoId;
  }
  return t;
}
async function audio(token:string,index:number){
  const s=get(token);
  const cached=s.audioBuffers.get(index);
  if(cached)return{track:s.tracks[index]!,buffer:cached,mime:s.audioMimes.get(index)||"audio/mpeg"};

  const t=await resolveSpotifyTrack(token,index);
  let buffer:Buffer;

  if(t.audioUrl?.startsWith("youtube://")){
    const videoId=t.audioUrl.slice("youtube://".length);
    const y=await youtubeAudio(videoId);
    buffer=y.buffer;
    s.audioMimes.set(index,y.mime);
  }else{
    const r=await fetch(t.audioUrl!,{headers:{"User-Agent":UA,"Referer":"https://y2mate.gs/"}});
    if(!r.ok)throw new Error("Audio gagal diambil");
    buffer=Buffer.from(await r.arrayBuffer());
    s.audioMimes.set(index,String(r.headers.get("content-type")||"audio/mpeg").split(";")[0]);
  }

  if(!s.audioMimes.has(index))s.audioMimes.set(index,"audio/mpeg");
  s.audioBuffers.set(index,buffer);
  return{track:t,buffer,mime:s.audioMimes.get(index)||"audio/mpeg"};
}
export async function getSpotifyAudio(token:string,index:number){return audio(token,index)}
export async function sendSpotifyTrack(token:string,index:number){const s=get(token),{track,buffer}=await audio(token,index);const media=new MessageMedia("audio/mpeg",buffer.toString("base64"),track.title.replace(/[<>:"/\\|?*\x00-\x1F]/g," ").slice(0,120)+".mp3");await s.client.sendMessage(s.chatId,media);return{title:track.title}}
setInterval(()=>{const c=Date.now()-SESSION_TTL;for(const [k,v] of sessions)if(v.createdAt<c)sessions.delete(k)},60000).unref();
