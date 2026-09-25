import { randomBytes } from "node:crypto";
import { MessageMedia, type Client } from "whatsapp-web.js";
import scrapr from "@coflyn/scrapr";
const scraprYoutube:any=(scrapr as any).youtube;

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
async function y2mGet(videoId:string){
  const h={
    "Origin":"https://y2mate.gs",
    "Referer":"https://y2mate.gs/",
    "Accept":"application/json, text/plain, */*",
    "User-Agent":UA,
  };

  const auth:any=await json(
    Y2MATE_API+"/api/v1/auth?api_key="+Y2MATE_KEY+"&_="+Date.now(),
    {headers:h}
  );
  if(!auth?.key)throw new Error("y2mate auth gagal");

  const init:any=await json(
    Y2MATE_API+"/api/v1/init?_="+Date.now(),
    {headers:{...h,Authorization:"Bearer "+auth.key}}
  );
  if(!init?.convertURL)throw new Error("y2mate init gagal");

  let url=init.convertURL,progress:string|null=null;

  for(let i=0;i<20;i++){
    const u=new URL(url);
    u.searchParams.set("v",videoId);
    u.searchParams.set("f","mp3");
    u.searchParams.set("_",String(Date.now()));

    const d:any=await json(
      u.toString(),
      {headers:{...h,Authorization:"Bearer "+auth.key}}
    );

    if(d?.downloadURL){
      const raw=String(d.downloadURL);
      return raw+(raw.includes("r=y2mate.gs")?"":(raw.includes("?")?"&":"?")+"v="+encodeURIComponent(videoId)+"&f=mp3&r=y2mate.gs");
    }
    if(d?.progressURL)progress=String(d.progressURL);
    if(d?.redirectURL){
      url=String(d.redirectURL);
      await new Promise(r=>setTimeout(r,1500));
      continue;
    }
    break;
  }

  if(progress)for(let i=0;i<30;i++){
    await new Promise(r=>setTimeout(r,3000));
    const d:any=await json(progress,{headers:h});
    if(d?.downloadURL){
      const raw=String(d.downloadURL);
      return raw+(raw.includes("r=y2mate.gs")?"":(raw.includes("?")?"&":"?")+"v="+encodeURIComponent(videoId)+"&f=mp3&r=y2mate.gs");
    }
    if(d?.redirectURL){
      const rd:any=await json(String(d.redirectURL),{headers:h});
      if(rd?.downloadURL){
        const raw=String(rd.downloadURL);
        return raw+(raw.includes("r=y2mate.gs")?"":(raw.includes("?")?"&":"?")+"v="+encodeURIComponent(videoId)+"&f=mp3&r=y2mate.gs");
      }
      if(rd?.progressURL)progress=String(rd.progressURL);
    }
  }

  throw new Error("Audio tidak tersedia");
}
function get(token:string){const s=sessions.get(token);if(!s||Date.now()-s.createdAt>SESSION_TTL){sessions.delete(token);throw new Error("Sesi Spotify kedaluwarsa. Buka Spotify lagi.")}return s}
export function createSpotifySession(client:Client,chatId:string){const token=randomBytes(24).toString("hex");sessions.set(token,{client,chatId,createdAt:Date.now(),tracks:[],audioBuffers:new Map(),audioMimes:new Map()});return token}
export async function spotifySearch(token:string,q:string){const s=get(token);const v=q.trim();if(!v)throw new Error("Query kosong");s.tracks=(/^https?:\/\/open\.spotify\.com\//i.test(v)?await infoSpotify(v.split("?")[0]):await searchSpotify(v)).slice(0,12);return s.tracks.map(({audioUrl,...x})=>x)}
export function getSpotifyTrack(token:string,index:number){const s=get(token),t=s.tracks[index];if(!t)throw new Error("Track tidak ditemukan");return t}
async function fetchDownload(url:string,referer:string){
  const r=await fetch(url,{
    headers:{
      "User-Agent":UA,
      "Accept":"*/*",
      "Referer":referer,
    },
  });
  if(!r.ok)throw new Error("Downloader HTTP "+r.status);
  return{
    buffer:Buffer.from(await r.arrayBuffer()),
    mime:String(r.headers.get("content-type")||"audio/mpeg").split(";")[0],
  };
}

async function convert1s(videoUrl:string){
  const headers={
    "User-Agent":UA,
    "Origin":"https://media.ytmp3.gg",
    "Referer":"https://media.ytmp3.gg/",
    "Content-Type":"application/json",
    "Accept":"application/json, text/plain, */*",
  };

  const initRes=await fetch("https://hub.convert1s.com/api/download",{
    method:"POST",
    headers,
    body:JSON.stringify({
      url:videoUrl,
      os:"macos",
      output:{type:"audio",format:"mp3",quality:""},
      audio:{bitrate:"128k"},
    }),
  });
  if(!initRes.ok)throw new Error("convert1s HTTP "+initRes.status);

  const init:any=await initRes.json();
  if(!init?.statusUrl)throw new Error("convert1s tidak memberi statusUrl");

  for(let i=0;i<15;i++){
    await new Promise(r=>setTimeout(r,1500));
    const pollRes=await fetch(init.statusUrl,{headers});
    if(!pollRes.ok)continue;
    const poll:any=await pollRes.json();
    if(poll?.status==="completed"&&poll?.downloadUrl){
      return String(poll.downloadUrl);
    }
    if(poll?.status==="error"||poll?.status==="failed")break;
  }
  throw new Error("convert1s timeout");
}

async function ytmp3Mobi(videoId:string){
  const base={
    "User-Agent":UA,
    "Origin":"https://ytmp3.mobi",
    "Referer":"https://ytmp3.mobi/",
    "Accept":"application/json, text/plain, */*",
  };

  const initRes=await fetch("https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471",{headers:base});
  if(!initRes.ok)throw new Error("ytmp3.mobi init HTTP "+initRes.status);
  const init:any=await initRes.json();
  if(!init?.convertURL)throw new Error("ytmp3.mobi init gagal");

  const convertUrl=new URL(String(init.convertURL));
  convertUrl.searchParams.set("v",videoId);
  convertUrl.searchParams.set("f","mp3");

  const convRes=await fetch(convertUrl.toString(),{headers:base});
  if(!convRes.ok)throw new Error("ytmp3.mobi convert HTTP "+convRes.status);
  const conv:any=await convRes.json();

  let finalUrl=conv?.downloadURL||null;
  let progressUrl=conv?.progressURL||null;
  for(let i=0;i<10&&!finalUrl&&progressUrl;i++){
    await new Promise(r=>setTimeout(r,2000));
    const pRes=await fetch(progressUrl,{headers:base});
    if(!pRes.ok)continue;
    const p:any=await pRes.json();
    if(p?.downloadURL)finalUrl=String(p.downloadURL);
    if(p?.progressURL)progressUrl=String(p.progressURL);
    if(p?.redirectURL){
      const rr=new URL(String(p.redirectURL));
      rr.searchParams.set("v",videoId);
      rr.searchParams.set("f","mp3");
      const rrRes=await fetch(rr.toString(),{headers:base});
      if(rrRes.ok){
        const rd:any=await rrRes.json();
        if(rd?.downloadURL)finalUrl=String(rd.downloadURL);
        if(rd?.progressURL)progressUrl=String(rd.progressURL);
      }
    }
  }
  if(!finalUrl)throw new Error("ytmp3.mobi downloadURL tidak ditemukan");
  return finalUrl.startsWith("//")?"https:"+finalUrl:finalUrl;
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
    try{
      t.audioUrl=await y2mGet(r[0].videoId);
    }catch{
      t.audioUrl="youtube://"+r[0].videoId;
    }
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
