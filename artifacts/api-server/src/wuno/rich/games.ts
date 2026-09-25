const base = (title: string, body: string, script: string) => String.raw`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
*{box-sizing:border-box}body{margin:0;background:#07090d;color:#f7f8fb;font-family:system-ui,sans-serif;padding:14px}.app{max-width:560px;margin:auto}.card{background:#11151d;border:1px solid #262d38;border-radius:18px;padding:16px;margin-bottom:12px}button{border:0;border-radius:12px;padding:12px 16px;background:#7357ff;color:#fff;font-weight:800}h1{font-size:24px}.muted{color:#9ca6b5}.board{margin:15px auto;display:grid;gap:4px}.status{font-weight:800;margin:10px 0}.red{background:#e5484d}.yellow{background:#f5c542}.cell{background:#171c26;border-radius:8px;min-height:48px}.ttt{grid-template-columns:repeat(3,80px);justify-content:center}.ttt button{height:80px;font-size:30px;padding:0;background:#171c26}.c4{grid-template-columns:repeat(7,42px);justify-content:center}.c4 button{padding:0;height:42px;border-radius:50%;background:#171c26}.c4 .p1{background:#e5484d}.c4 .p2{background:#f5c542}.controls{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.input{width:100%;padding:12px;border-radius:12px;border:1px solid #303746;background:#090c12;color:#fff;margin:8px 0}</style></head><body><div class="app"><div class="card"><h1>${title}</h1><div id="status" class="status">Menghubungkan...</div>${body}</div></div><script>
const WS_URL="__WUNO_WS_URL__";let ws;const q=new URLSearchParams(location.search);const game=q.get("game")||"solo";
function connect(){if(!WS_URL){status("Server game belum siap");return}ws=new WebSocket(WS_URL);ws.onopen=()=>{ws.send(JSON.stringify({type:"join",game,room:q.get("room"),player:q.get("player"),name:q.get("name")}));status("Terhubung • tunggu pemain lain")};ws.onmessage=e=>{try{onState(JSON.parse(e.data))}catch{}};ws.onclose=()=>status("Koneksi terputus. Buka game lagi untuk menyambung.")}function send(a){if(ws?.readyState===1)ws.send(JSON.stringify(a))}function status(s){document.getElementById("status").textContent=s}connect();
${script}</script></body></html>`;

export const TTT_HTML = base("⭕ Tic-Tac-Toe • 2 Pemain", '<div id="board" class="board ttt"></div><div class="controls"><button onclick="location.reload()">Keluar / Buka lagi</button></div>', `
let b=Array(9).fill(""),me="",turn="";
function onState(s){if(s.game!=="tictactoe")return; b=s.board||b;me=s.me||me;turn=s.turn||turn;status(s.message||("Kamu: "+me+" • Giliran: "+turn));render()}
function render(){let el=document.getElementById("board");el.innerHTML="";b.forEach((v,i)=>{let x=document.createElement("button");x.textContent=v;x.onclick=()=>send({type:"move",index:i});el.appendChild(x)})}
`);

export const CONNECT4_HTML = base("🔴 Connect Four • 2 Pemain", '<div id="board" class="board c4"></div><div class="controls"><button onclick="send({type:"new"})">Main baru</button></div>', `
let b=Array(42).fill(""),me="",turn="";
function onState(s){if(s.game!=="connect4")return;b=s.board||b;me=s.me||me;turn=s.turn||turn;status(s.message||("Kamu: "+me+" • Giliran: "+turn));render()}
function render(){let el=document.getElementById("board");el.innerHTML="";for(let i=0;i<42;i++){let x=document.createElement("button");x.className=b[i]?("p"+b[i]):"";x.onclick=()=>send({type:"move",col:i%7});el.appendChild(x)}}
`);

export const TETRIS_HTML = String.raw`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#07090d;color:#fff;font-family:system-ui;padding:16px}.card{max-width:500px;margin:auto;background:#11151d;border-radius:18px;padding:16px}.board{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;background:#05070a;padding:5px}.c{aspect-ratio:1;background:#171c26}.f{background:#7357ff}.controls{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px}button{padding:12px;border:0;border-radius:10px;background:#7357ff;color:#fff;font-weight:800}</style></head><body><div class="card"><h1>🧱 WUNO Tetris</h1><p id="s">Skor 0</p><div id="b" class="board"></div><div class="controls"><button onclick="mv(-1)">←</button><button onclick="rot()">↻</button><button onclick="down()">↓</button><button onclick="hard()">⤓</button><button onclick="mv(1)">→</button></div></div><script>
const W=10,H=20,S=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]]];let g=Array.from({length:H},()=>Array(W).fill(0)),p,x,y,sc=0,over=0;
function np(){p=S[Math.random()*S.length|0].map(r=>[...r]);x=(W-p[0].length)/2|0;y=0;if(hit(0,0))over=1}function hit(dx,dy,q=p){return q.some((r,j)=>r.some((v,i)=>v&&(x+i+dx<0||x+i+dx>=W||y+j+dy>=H||g[y+j+dy]?.[x+i+dx])))}function merge(){p.forEach((r,j)=>r.forEach((v,i)=>{if(v)g[y+j][x+i]=1}))}function clear(){let n=0;g=g.filter(r=>r.some(v=>!v)?1:(n++,0));while(g.length<H)g.unshift(Array(W).fill(0));sc+=n*n*100}function draw(){let e=document.getElementById("b");e.innerHTML="";for(let j=0;j<H;j++)for(let i=0;i<W;i++){let d=document.createElement("div");d.className="c"+(g[j][i]?" f":"");e.appendChild(d)}p?.forEach((r,j)=>r.forEach((v,i)=>{if(v){let k=(y+j)*W+x+i;e.children[k]?.classList.add("f")}}));document.getElementById("s").textContent=over?"Game Over • Skor "+sc:"Skor "+sc}function step(){if(over)return;if(!hit(0,1))y++;else{merge();clear();np()}draw()}function mv(d){if(!over&&!hit(d,0))x+=d;draw()}function rot(){let q=p[0].map((_,i)=>p.map(r=>r[i]).reverse());if(!hit(0,0,q))p=q;draw()}function down(){while(!hit(0,1))y++;step()}function hard(){down()}np();draw();setInterval(step,600);
</script></body></html>`;

export const SPOTIFY_HTML = String.raw`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:transparent;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;padding:12px}
.wrap{max-width:520px;margin:auto}.card{background:linear-gradient(180deg,#292929,#101010);border-radius:20px;padding:18px}
.brand{display:flex;align-items:center;gap:9px;color:#1ed760;font-size:13px;font-weight:900;letter-spacing:1px;margin-bottom:16px}.brand b{font-size:20px}
.search{display:flex;gap:8px}.search input{flex:1;min-width:0;background:#181818;color:#fff;border:1px solid #444;border-radius:12px;padding:13px;font-size:14px;outline:none}.search button{border:0;border-radius:12px;padding:0 18px;background:#1ed760;color:#000;font-weight:900;font-size:14px}
#msg{font-size:12px;color:#999;min-height:18px;margin:10px 2px}.results{display:flex;flex-direction:column;gap:6px;margin-top:8px}.item{display:flex;align-items:center;gap:10px;padding:9px;background:#191919;border-radius:12px;cursor:pointer}.item img{width:54px;height:54px;border-radius:8px;object-fit:cover;background:#2a2a2a}.info{min-width:0;flex:1}.title{font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{font-size:11px;color:#aaa;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.player{margin-top:14px}.cover{width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;background:#222}.ptitle{font-size:17px;font-weight:900;text-align:center;margin-top:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.partist{font-size:12px;color:#aaa;text-align:center;margin-top:3px}.bar{display:flex;align-items:center;gap:8px;margin-top:12px}.bar span{font-size:10px;color:#999;min-width:30px;text-align:center}.bar input{flex:1}.controls{display:flex;justify-content:center;align-items:center;gap:22px;margin-top:8px}.controls button{border:0;background:none;color:#fff;font-size:25px;padding:8px}.controls .play{width:56px;height:56px;border-radius:50%;background:#1ed760;color:#000;font-size:23px}.send{display:block;margin:14px auto 0;border:0;border-radius:12px;padding:11px 18px;background:#fff;color:#000;font-weight:900}
</style></head><body><div class="wrap"><div class="card">
<div class="brand"><b>♫</b> SPOTIFY</div>
<div class="search"><input id="sq" type="text" placeholder="Judul lagu / artis"><button id="sbtn" type="button" onclick="spotifySearch()">Cari</button></div>
<div id="msg">Masukkan judul lagu lalu tekan Cari.</div>
<div id="results" class="results"></div>
<div class="player"><img id="cover" class="cover" alt=""><div id="ptitle" class="ptitle">Belum memilih lagu</div><div id="partist" class="partist">&nbsp;</div>
<div class="bar"><span id="cur">0:00</span><input id="seek" type="range" min="0" max="100" value="0"><span id="dur">0:00</span></div>
<div class="controls"><button type="button" onclick="prevTrack()">⏮</button><button id="play" type="button" class="play" onclick="togglePlay()">▶</button><button type="button" onclick="nextTrack()">⏭</button></div>
<button id="send" type="button" class="send" onclick="sendTrack()" disabled>Kirim ke WhatsApp</button></div>
<audio id="audio" preload="none"></audio>
</div></div>
<script>
var API_ORIGIN="__WUNO_API_ORIGIN__";
var TOKEN="__WUNO_SPOTIFY_TOKEN__";
var INITIAL_QUERY="__WUNO_SPOTIFY_INITIAL_QUERY__";
var tracks=[],currentIndex=-1,audioLoadedIndex=-1,busy=false;
var sq=document.getElementById("sq"),sbtn=document.getElementById("sbtn"),msg=document.getElementById("msg"),results=document.getElementById("results"),cover=document.getElementById("cover"),ptitle=document.getElementById("ptitle"),partist=document.getElementById("partist"),audio=document.getElementById("audio"),play=document.getElementById("play"),seek=document.getElementById("seek"),cur=document.getElementById("cur"),dur=document.getElementById("dur"),send=document.getElementById("send");
function esc(v){var d=document.createElement("div");d.textContent=v||"";return d.innerHTML}
function fmt(v){if(!isFinite(v)||v<0)v=0;return Math.floor(v/60)+":"+String(Math.floor(v%60)).padStart(2,"0")}
function url(path){return API_ORIGIN+path+(path.indexOf("?")>=0?"&":"?")+"token="+encodeURIComponent(TOKEN)}
function setMsg(v){msg.textContent=v||""}
function request(path,done){var x=new XMLHttpRequest();x.open("GET",url(path),true);x.timeout=25000;x.onreadystatechange=function(){if(x.readyState!==4)return;var data={};try{data=JSON.parse(x.responseText||"{}")}catch(e){}if(x.status>=200&&x.status<300)done(null,data);else done(new Error(data.error||("HTTP "+x.status)),data)};x.ontimeout=function(){done(new Error("Request timeout"))};x.onerror=function(){done(new Error("Tidak bisa terhubung ke server WUNO"))};x.send()}
function spotifySearch(){
 var q=sq.value.trim();if(!q)return;
 sbtn.disabled=true;setMsg("Mencari di SpotSaver...");results.innerHTML="<div class='sub'>Sedang mencari...</div>";
 request("/api/spotify/search?q="+encodeURIComponent(q),function(err,data){
   sbtn.disabled=false;
   if(err){results.innerHTML="<div class='sub'></div>";results.firstChild.textContent=err.message;setMsg("Pencarian gagal");return}
   tracks=Array.isArray(data.results)?data.results:[];currentIndex=-1;audioLoadedIndex=-1;renderResults();
   if(!tracks.length){setMsg("SpotSaver tidak menemukan lagu.");return}
   setMsg(tracks.length+" hasil ditemukan dari SpotSaver.");
   chooseTrack(0,false);
 });
}
function renderResults(){
 results.innerHTML="";
 tracks.forEach(function(t,i){
   var el=document.createElement("div");el.className="item";
   el.innerHTML="<img src='"+esc(t.thumbnail)+"'><div class='info'><div class='title'>"+esc(t.title)+"</div><div class='sub'>"+esc(t.artist||"Unknown Artist")+" • "+esc(t.album||"Unknown Album")+" • "+esc(t.duration||"0:00")+"</div></div>";
   el.onclick=function(){chooseTrack(i,true)};results.appendChild(el);
 });
}
function chooseTrack(i,auto){
 if(!tracks[i])return;currentIndex=i;audioLoadedIndex=-1;audio.pause();audio.currentTime=0;seek.value=0;
 var t=tracks[i];ptitle.textContent=t.title;partist.textContent=t.artist||"";cover.src=t.thumbnail||"";send.disabled=false;renderResults();if(auto)loadTrack(true);
}
function loadTrack(auto){
 if(currentIndex<0||busy)return;
 var t=tracks[currentIndex];busy=true;play.disabled=true;setMsg("Menyiapkan audio...");
 request("/api/spotify/resolve?index="+currentIndex,function(err,data){
   busy=false;play.disabled=false;
   if(err){setMsg(err.message||"Gagal menyiapkan audio");return}
   t.audioUrl=url("/api/spotify/stream?index="+currentIndex);audio.src=t.audioUrl;audio.load();audioLoadedIndex=currentIndex;setMsg("");
   if(auto)audio.play().catch(function(){setMsg("Tekan Play untuk memulai audio.")});
 });
}
function togglePlay(){if(currentIndex<0)return;if(audioLoadedIndex!==currentIndex){loadTrack(true);return}if(audio.paused)audio.play().catch(function(){});else audio.pause()}
function prevTrack(){if(!tracks.length)return;chooseTrack((currentIndex-1+tracks.length)%tracks.length,true)}
function nextTrack(){if(!tracks.length)return;chooseTrack((currentIndex+1)%tracks.length,true)}
function sendTrack(){
 if(currentIndex<0)return;send.disabled=true;send.textContent="Mengirim...";
 var x=new XMLHttpRequest();x.open("POST",url("/api/spotify/send?index="+currentIndex),true);x.timeout=120000;x.setRequestHeader("Content-Type","application/json");x.onreadystatechange=function(){if(x.readyState!==4)return;var d={};try{d=JSON.parse(x.responseText||"{}")}catch(e){}if(x.status>=200&&x.status<300){send.textContent="Terkirim ✓";setMsg("Audio sudah dikirim ke WhatsApp.")}else{send.textContent="Gagal";setMsg(d.error||"Gagal mengirim audio")}setTimeout(function(){send.disabled=false;send.textContent="Kirim ke WhatsApp"},2500)};x.onerror=function(){send.disabled=false;send.textContent="Kirim ke WhatsApp";setMsg("Tidak bisa terhubung ke server")};x.ontimeout=function(){send.disabled=false;send.textContent="Kirim ke WhatsApp";setMsg("Pengiriman timeout")};x.send("{}");
}
audio.addEventListener("play",function(){play.textContent="⏸"});audio.addEventListener("pause",function(){play.textContent="▶"});audio.addEventListener("timeupdate",function(){if(!audio.duration)return;seek.value=String(audio.currentTime/audio.duration*100);cur.textContent=fmt(audio.currentTime);dur.textContent=fmt(audio.duration)});audio.addEventListener("loadedmetadata",function(){dur.textContent=fmt(audio.duration)});audio.addEventListener("ended",nextTrack);seek.addEventListener("input",function(){if(audio.duration)audio.currentTime=Number(seek.value)/100*audio.duration});
sq.addEventListener("keydown",function(e){if(e.key==="Enter")spotifySearch()});
if(INITIAL_QUERY){sq.value=INITIAL_QUERY;setTimeout(spotifySearch,200)}
</script></body></html>`;

export { SPOTIFY_LIVE_HTML } from "../spotifyLive/html";
