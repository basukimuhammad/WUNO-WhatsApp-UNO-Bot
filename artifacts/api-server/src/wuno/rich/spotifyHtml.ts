export const SPOTIFY_PLAYER_HTML = String.raw`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
body{margin:0;background:transparent;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.wrap{max-width:410px;margin:auto;padding:14px}.card{background:linear-gradient(180deg,#383838,#121212 46%,#0b0b0b);border-radius:20px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.brand{display:flex;align-items:center;gap:8px;color:#1ed760;font-size:12px;font-weight:900;letter-spacing:1px;margin-bottom:14px}.brand b{font-size:20px}
.query{font-size:12px;color:#9a9a9a;margin-bottom:10px}.results{display:flex;flex-direction:column;gap:6px;max-height:230px;overflow:auto;margin-bottom:14px}.item{display:flex;align-items:center;gap:10px;padding:9px;background:#191919;border-radius:12px}.item.active{outline:1px solid #1ed760}.item img{width:48px;height:48px;border-radius:7px;object-fit:cover;background:#252525}.info{flex:1;min-width:0}.title{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{font-size:11px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
.cover{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;background:#242424}.meta{text-align:center;margin-top:12px}.ptitle{font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.partist{font-size:12px;color:#aaa;margin-top:3px}.bar{display:flex;align-items:center;gap:7px;margin-top:14px}.bar span{font-size:10px;color:#999;min-width:30px;text-align:center}.bar input{flex:1}
.controls{display:flex;justify-content:center;align-items:center;gap:20px;margin-top:8px}.ctrl{border:0;background:none;color:#fff;font-size:25px;padding:8px}.play{width:56px;height:56px;border-radius:50%;background:#1ed760;color:#000;font-size:22px}.download{display:block;margin:12px auto 0;border:0;border-radius:12px;padding:11px 18px;background:#fff;color:#000;font-weight:900}.download:disabled{opacity:.5}.status{text-align:center;color:#999;font-size:11px;min-height:16px;margin-top:9px}
</style></head><body><div class="wrap"><div class="card">
<div class="brand"><b>♫</b> SPOTIFY</div>
<div id="query" class="query"></div>
<div id="results" class="results"></div>
<img id="cover" class="cover" alt="">
<div class="meta"><div id="ptitle" class="ptitle">Memuat...</div><div id="partist" class="partist">&nbsp;</div></div>
<div class="bar"><span id="cur">0:00</span><input id="seek" type="range" min="0" max="100" value="0" step="0.1"><span id="dur">0:00</span></div>
<div class="controls"><button id="prev" class="ctrl" type="button" onclick="prevTrack()">⏮</button><button id="play" class="ctrl play" type="button" onclick="togglePlay()">▶</button><button id="next" class="ctrl" type="button" onclick="nextTrack()">⏭</button></div>
<button id="download" class="download" type="button" onclick="downloadTrack()">Download</button>
<div id="status" class="status"></div><audio id="audio" preload="none"></audio>
</div></div>
<script>
var API_ORIGIN="__WUNO_API_ORIGIN__";
var WS_URL="__WUNO_WS_URL__";
var TOKEN="__WUNO_SPOTIFY_TOKEN__";
var QUERY="__WUNO_SPOTIFY_QUERY__";
var tracks=__WUNO_SPOTIFY_TRACKS__;
var idx=0,loadedIdx=-1,loading=false,ws=null,pending={};

var queryEl=document.getElementById("query"),resultsEl=document.getElementById("results"),coverEl=document.getElementById("cover"),titleEl=document.getElementById("ptitle"),artistEl=document.getElementById("partist"),audioEl=document.getElementById("audio"),seekEl=document.getElementById("seek"),curEl=document.getElementById("cur"),durEl=document.getElementById("dur"),playBtn=document.getElementById("play"),downloadBtn=document.getElementById("download"),statusEl=document.getElementById("status");

function esc(v){var d=document.createElement("div");d.textContent=v||"";return d.innerHTML}
function fmt(v){if(!isFinite(v)||v<0)v=0;return Math.floor(v/60)+":"+String(Math.floor(v%60)).padStart(2,"0")}
function status(v){statusEl.textContent=v||""}

function connectWs(){
  if(!WS_URL)return;
  try{ws=new WebSocket(WS_URL)}catch(e){status("Koneksi player gagal");return}
  ws.onopen=function(){status("Player siap");setTimeout(function(){status("")},1200)};
  ws.onmessage=function(e){
    var m;try{m=JSON.parse(e.data)}catch(_){return}
    if(m.type==="spotifyActionResult"&&m.requestId&&pending[m.requestId]){var fn=pending[m.requestId];delete pending[m.requestId];fn(m)}
  };
  ws.onclose=function(){for(var k in pending){pending[k]({success:false,message:"Koneksi player terputus"});delete pending[k]}}
}
function action(type,index,timeoutMs){
  return new Promise(function(resolve){
    if(!ws||ws.readyState!==1){resolve({success:false,message:"Player belum terhubung"});return}
    var requestId=Math.random().toString(36).slice(2),done=false;
    var timer=setTimeout(function(){if(done)return;done=true;delete pending[requestId];resolve({success:false,message:"Aksi timeout"})},timeoutMs||30000);
    pending[requestId]=function(msg){if(done)return;done=true;clearTimeout(timer);resolve(msg)};
    ws.send(JSON.stringify({type:type,token:TOKEN,index:index,requestId:requestId}));
  });
}
function render(){
  queryEl.textContent=QUERY?("Hasil SpotSaver untuk: "+QUERY):"Hasil pencarian";
  resultsEl.innerHTML="";
  tracks.forEach(function(t,i){
    var el=document.createElement("div");el.className="item"+(i===idx?" active":"");
    el.innerHTML="<img src='"+esc(t.thumbnail||"")+"'><div class='info'><div class='title'>"+esc(t.title)+"</div><div class='sub'>"+esc(t.artist||"Unknown Artist")+" • "+esc(t.album||"Unknown Album")+" • "+esc(t.duration||"0:00")+"</div></div>";
    el.onclick=function(){selectTrack(i,true)};resultsEl.appendChild(el);
  });
  updateMeta();
}
function updateMeta(){var t=tracks[idx];if(!t)return;titleEl.textContent=t.title;artistEl.textContent=t.artist||" ";coverEl.src=t.thumbnail||""}
function selectTrack(i,auto){if(!tracks[i])return;idx=i;loadedIdx=-1;audioEl.pause();audioEl.currentTime=0;seekEl.value=0;render();if(auto)loadCurrent(true)}
async function loadCurrent(autoplay){
  var t=tracks[idx];if(!t||loading)return;
  if(t.audioUrl){audioEl.src=t.audioUrl;audioEl.load();loadedIdx=idx;if(autoplay)audioEl.play().catch(function(){status("Tekan Play")});return}
  loading=true;playBtn.disabled=true;status("Menyiapkan audio...");
  var r=await action("spotifyResolve",idx,100000);
  loading=false;playBtn.disabled=false;
  if(!r.success||!r.audioUrl){status(r.message||"Audio gagal disiapkan");return}
  t.audioUrl=r.audioUrl.charAt(0)==="/" ? API_ORIGIN+r.audioUrl : r.audioUrl;
  if(r.cover)coverEl.src=r.cover;
  audioEl.src=t.audioUrl;audioEl.load();loadedIdx=idx;status("");
  if(autoplay)audioEl.play().catch(function(){status("Tekan Play untuk memulai")});
}
function togglePlay(){if(idx<0)return;if(loadedIdx!==idx){loadCurrent(true);return}if(audioEl.paused)audioEl.play().catch(function(){});else audioEl.pause()}
function prevTrack(){if(tracks.length<2)return;idx=(idx-1+tracks.length)%tracks.length;loadedIdx=-1;audioEl.pause();render();loadCurrent(true)}
function nextTrack(){if(tracks.length<2)return;idx=(idx+1)%tracks.length;loadedIdx=-1;audioEl.pause();render();loadCurrent(true)}
async function downloadTrack(){downloadBtn.disabled=true;downloadBtn.textContent="Mengirim...";var r=await action("spotifyDownload",idx,120000);downloadBtn.textContent=r.success?"Terkirim ✓":"Gagal";status(r.success?"Audio sudah dikirim ke WhatsApp.":(r.message||"Gagal mengirim audio"));setTimeout(function(){downloadBtn.disabled=false;downloadBtn.textContent="Download"},2500)}
audioEl.addEventListener("play",function(){playBtn.textContent="⏸"});audioEl.addEventListener("pause",function(){playBtn.textContent="▶"});audioEl.addEventListener("timeupdate",function(){if(!audioEl.duration)return;seekEl.value=audioEl.currentTime/audioEl.duration*100;curEl.textContent=fmt(audioEl.currentTime);durEl.textContent=fmt(audioEl.duration)});audioEl.addEventListener("loadedmetadata",function(){durEl.textContent=fmt(audioEl.duration)});audioEl.addEventListener("ended",nextTrack);audioEl.addEventListener("error",function(){status("Audio gagal diputar")});seekEl.addEventListener("input",function(){if(audioEl.duration)audioEl.currentTime=Number(seekEl.value)/100*audioEl.duration});
connectWs();render();loadCurrent(false);
</script></body></html>`;