type SpotifyHtmlTrack = {
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbnail: string | null;
};

export function buildSpotifyPlayerHtml(
  token: string,
  query: string,
  tracks: SpotifyHtmlTrack[],
) {
  const safeToken = JSON.stringify(token);
  const safeQuery = JSON.stringify(query);
  const safeTracks = JSON.stringify(tracks.slice(0, 8)).replace(/</g, "\\u003c");

  return String.raw`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
body{margin:0;background:transparent;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.wrap{width:100%;max-width:410px;margin:auto;padding:14px}
.card{background:linear-gradient(180deg,#383838 0%,#121212 46%,#090909 100%);border-radius:20px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.brand{display:flex;align-items:center;gap:8px;color:#1ed760;font-size:13px;font-weight:900;letter-spacing:1px;margin-bottom:12px}.brand b{font-size:21px}
.query{text-align:center;color:#aaa;font-size:11px;margin-bottom:12px}
.cover-wrap{position:relative;width:100%;aspect-ratio:1;border-radius:14px;overflow:hidden;background:#242424;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.cover{width:100%;height:100%;display:block;object-fit:cover}.spinner{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);font-size:13px;font-weight:800}
.meta{text-align:center;padding:12px 4px 0}.title{font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.artist{font-size:12px;color:#aaa;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{display:flex;align-items:center;gap:7px;margin-top:12px}.bar span{font-size:10px;color:#999;min-width:32px;text-align:center}.bar input{flex:1}
.controls{display:flex;justify-content:center;align-items:center;gap:18px;margin-top:7px}.ctrl{width:46px;height:46px;border:0;background:transparent;color:#fff;font-size:25px;border-radius:50%}.ctrl:disabled{opacity:.3}.play{width:58px;height:58px;background:#1ed760;color:#000;font-size:23px}
.bottom{display:flex;align-items:center;justify-content:space-between;margin-top:8px}.counter{font-size:11px;color:#888}.dl{border:0;border-radius:12px;padding:10px 17px;background:#fff;color:#000;font-weight:900}.dl:disabled{opacity:.5}
.error{min-height:16px;text-align:center;color:#ff8f8f;font-size:11px;margin-top:8px}
</style>
</head>
<body>
<div class="wrap"><div class="card">
<div class="brand"><b>♫</b> SPOTIFY</div>
<div id="query" class="query"></div>
<div class="cover-wrap"><img id="cover" class="cover" alt=""><div id="spinner" class="spinner">Menyiapkan audio...</div></div>
<div class="meta"><div id="title" class="title">Memuat...</div><div id="artist" class="artist"></div></div>
<div class="bar"><span id="curTime">0:00</span><input id="seek" type="range" min="0" max="100" value="0" step="0.1"><span id="durTime">0:00</span></div>
<div class="controls">
<button id="prev" class="ctrl" type="button">⏮</button>
<button id="playBtn" class="ctrl play" type="button">▶</button>
<button id="next" class="ctrl" type="button">⏭</button>
</div>
<div class="bottom"><span id="counter" class="counter"></span><button id="dl" class="dl" type="button">Download</button></div>
<div id="error" class="error"></div>
</div></div>
<audio id="audio" preload="none"></audio>
<script>
const TOKEN=\${safeToken};
const QUERY=\${safeQuery};
const TRACKS=\${safeTracks};
const API_ORIGIN="__WUNO_API_ORIGIN__";
const WS_URL=API_ORIGIN.replace(/^https:/,"wss:").replace(/^http:/,"ws:")+"/ws/games?game=spotify";
let idx=0,loading=false,loadedIdx=-1,audioRetry=false,ws=null;
const pending={};
const wsWaiters=[];
const cover=document.getElementById("cover"),spinner=document.getElementById("spinner"),title=document.getElementById("title"),artist=document.getElementById("artist"),queryEl=document.getElementById("query"),counter=document.getElementById("counter"),seek=document.getElementById("seek"),cur=document.getElementById("curTime"),dur=document.getElementById("durTime"),play=document.getElementById("playBtn"),prev=document.getElementById("prev"),next=document.getElementById("next"),dl=document.getElementById("dl"),errorEl=document.getElementById("error"),audio=document.getElementById("audio");

function fmt(v){if(!isFinite(v)||v<0)v=0;return Math.floor(v/60)+":"+String(Math.floor(v%60)).padStart(2,"0")}
function showError(v){errorEl.textContent=v||""}
function coverUrl(i){return API_ORIGIN+"/api/spotify/cover?token="+encodeURIComponent(TOKEN)+"&index="+encodeURIComponent(String(i))}
function render(){
  const t=TRACKS[idx];if(!t)return;
  queryEl.textContent="Hasil SpotSaver untuk: "+QUERY;
  title.textContent=t.title||"Unknown Title";
  artist.textContent=t.artist||"Unknown Artist";
  counter.textContent=(idx+1)+" / "+TRACKS.length;
  cover.src=coverUrl(idx);
}
cover.addEventListener("error",function(){cover.removeAttribute("src")});

function notifyWs(){while(wsWaiters.length){const f=wsWaiters.shift();f(ws&&ws.readyState===1)}}
function connectWs(){
  try{ws=new WebSocket(WS_URL)}catch(e){notifyWs();return}
  ws.onopen=function(){notifyWs()};
  ws.onmessage=function(e){
    let m;try{m=JSON.parse(e.data)}catch(_){return}
    if(m.type!=="spotifyActionResult"||!m.requestId||!pending[m.requestId])return;
    const fn=pending[m.requestId];delete pending[m.requestId];fn(m);
  };
  ws.onclose=function(){notifyWs();setTimeout(connectWs,1500)};
  ws.onerror=function(){};
}
connectWs();

function waitWs(ms){
  if(ws&&ws.readyState===1)return Promise.resolve(true);
  return new Promise(function(resolve){
    let done=false;
    const timer=setTimeout(function(){if(done)return;done=true;resolve(false)},ms||10000);
    wsWaiters.push(function(ok){if(done)return;done=true;clearTimeout(timer);resolve(ok)});
  });
}
async function action(type,index,timeoutMs){
  if(!(await waitWs(10000)))return {success:false,message:"Player belum terhubung."};
  return new Promise(function(resolve){
    const id=Math.random().toString(36).slice(2);
    const timer=setTimeout(function(){delete pending[id];resolve({success:false,message:"Aksi timeout."})},timeoutMs||30000);
    pending[id]=function(m){clearTimeout(timer);resolve(m)};
    ws.send(JSON.stringify({type:type,token:TOKEN,index:index,requestId:id}));
  });
}
async function loadCurrent(autoPlay){
  const t=TRACKS[idx];if(!t||loading)return;
  render();showError("");loading=true;spinner.style.display="flex";play.disabled=true;
  const result=await action("spotifyResolve",idx,100000);
  loading=false;spinner.style.display="none";play.disabled=false;
  if(!result.success||!result.audioUrl){showError(result.message||"Audio gagal disiapkan.");return}
  t.audioUrl=result.audioUrl.charAt(0)==="/" ? API_ORIGIN+result.audioUrl : result.audioUrl;
  audio.src=t.audioUrl;audio.load();loadedIdx=idx;audioRetry=false;
  if(autoPlay)audio.play().catch(function(){showError("Tekan Play untuk memulai.")});
}
function go(step){
  if(TRACKS.length<2||loading)return;
  idx=(idx+step+TRACKS.length)%TRACKS.length;loadedIdx=-1;audio.pause();audio.currentTime=0;seek.value=0;cur.textContent="0:00";dur.textContent="0:00";loadCurrent(true);
}
play.addEventListener("click",function(){
  if(loading)return;
  if(loadedIdx!==idx){loadCurrent(true);return}
  if(audio.paused)audio.play().catch(function(){showError("Tekan Play untuk memulai.")});else audio.pause();
});
prev.addEventListener("click",function(){go(-1)});
next.addEventListener("click",function(){go(1)});
audio.addEventListener("play",function(){play.textContent="⏸"});
audio.addEventListener("pause",function(){play.textContent="▶"});
audio.addEventListener("loadedmetadata",function(){dur.textContent=fmt(audio.duration)});
audio.addEventListener("timeupdate",function(){if(!audio.duration)return;seek.value=(audio.currentTime/audio.duration)*100;cur.textContent=fmt(audio.currentTime)});
audio.addEventListener("ended",function(){go(1)});
audio.addEventListener("error",function(){
  if(!audioRetry&&audio.src){audioRetry=true;setTimeout(function(){audio.load()},700);return}
  showError("Audio gagal diputar.");
});
seek.addEventListener("input",function(){if(audio.duration)audio.currentTime=(Number(seek.value)/100)*audio.duration});
dl.addEventListener("click",async function(){
  dl.disabled=true;dl.textContent="Mengirim...";
  const r=await action("spotifyDownload",idx,120000);
  dl.textContent=r.success?"Terkirim ✓":"Gagal";
  showError(r.success?"Audio sudah dikirim ke WhatsApp.":(r.message||"Gagal mengirim audio."));
  setTimeout(function(){dl.disabled=false;dl.textContent="Download"},2500);
});
render();
<\/script>
</body></html>`;
}

export const SPOTIFY_PLAYER_HTML = "";
