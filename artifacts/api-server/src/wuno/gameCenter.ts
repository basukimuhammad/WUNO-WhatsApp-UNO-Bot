export const gameCenterHtml = String.raw`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#090b10">
<title>WUNO Game Center</title>
<style>
:root{--bg:#090b10;--panel:#121620;--panel2:#181e2a;--line:#293142;--text:#f7f8fb;--muted:#97a1b3;--a:#7b61ff;--b:#2bd3ad;--gold:#ffd166}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(900px 450px at 85% -10%,#2a2054 0,transparent 60%),var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.wrap{max-width:920px;margin:auto;padding:18px}.top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:16px}.brand{display:flex;align-items:center;gap:11px}.logo{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,var(--a),var(--b));font-size:25px}.title{font-weight:850;font-size:21px}.muted{color:var(--muted);font-size:12px}.tabs{display:flex;gap:6px;background:#0e1219;border:1px solid var(--line);padding:5px;border-radius:15px}.tab{border:0;background:transparent;color:var(--muted);padding:9px 13px;border-radius:11px;font-weight:800}.tab.on{background:var(--panel2);color:var(--text)}.page{display:none}.page.on{display:block}.hero{padding:22px;border-radius:23px;border:1px solid #39365b;background:linear-gradient(145deg,rgba(123,97,255,.19),rgba(43,211,173,.07));box-shadow:0 20px 60px rgba(0,0,0,.28);margin-bottom:14px}.hero h1{font-size:30px;line-height:1.04;margin:0 0 8px}.hero p{margin:0;color:var(--muted);max-width:690px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px}.card{background:rgba(18,22,32,.94);border:1px solid var(--line);border-radius:20px;padding:15px;box-shadow:0 12px 35px rgba(0,0,0,.2)}.card h2{font-size:18px;margin:0 0 4px}.card p{color:var(--muted);font-size:13px;margin:0 0 12px}.btn{border:0;border-radius:12px;padding:10px 13px;background:var(--a);color:#fff;font-weight:850;cursor:pointer}.btn.alt{background:#252d3a}.btn.green{background:var(--b);color:#07110d}.box{margin-top:12px;padding:12px;border-radius:16px;background:#0c1017;border:1px solid var(--line)}.status{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:12px;margin-bottom:10px}.ttt{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;max-width:300px;margin:auto}.cell{aspect-ratio:1;border:1px solid var(--line);border-radius:13px;background:#151b25;color:#fff;font-size:30px;font-weight:900}.x{color:#9a8bff}.o{color:#37dfb9}.tap{min-height:190px;display:grid;place-items:center}.tap button{width:145px;height:145px;border-radius:50%;border:8px solid rgba(255,255,255,.08);background:radial-gradient(circle at 35% 30%,#a48fff,#6342e9);color:#fff;font-size:21px;font-weight:900}.musicbox{display:grid;gap:12px}.search{display:flex;gap:8px}.search input{min-width:0;flex:1;background:#0c1017;border:1px solid var(--line);border-radius:12px;color:#fff;padding:11px;outline:none}.spotify{display:grid;grid-template-columns:95px 1fr;gap:14px;align-items:center}.cover{width:95px;height:95px;border-radius:18px;background:linear-gradient(135deg,#1ed760,#0a642f);display:grid;place-items:center;font-size:40px}.foot{text-align:center;color:#667084;font-size:11px;padding:18px}
@media(max-width:700px){.grid{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}.tabs{width:100%}.tab{flex:1}}
</style>
</head>
<body>
<div class="wrap">
<div class="top"><div class="brand"><div class="logo">🎮</div><div><div class="title">WUNO Game Center</div><div class="muted">Mini games & music tools</div></div></div><div class="tabs"><button class="tab on" data-p="arcade">🎮 Arcade</button><button class="tab" data-p="music">🎵 Music</button></div></div>

<section id="arcade" class="page on">
<div class="hero"><h1>Main cepat.<br>Seru lebih lama.</h1><p>Pusat mini-game WUNO yang ringan untuk HP. Game berjalan langsung di halaman ini tanpa instal aplikasi tambahan.</p></div>
<div class="grid">
<div class="card"><h2>⭕ Tic-Tac-Toe</h2><p>Lawan bot dan coba menang dalam tiga langkah.</p><button class="btn" onclick="showTTT()">Mainkan</button><div id="tttBox" class="box" hidden><div class="status"><span id="tttStatus">Giliran kamu</span><button class="btn alt" onclick="resetTTT()">Reset</button></div><div id="ttt" class="ttt"></div></div></div>
<div class="card"><h2>⚡ Tap Rush</h2><p>Kejar skor tap tertinggi dalam 10 detik.</p><button class="btn green" onclick="startTap()">Mulai</button><div id="tapBox" class="box" hidden><div class="status"><span id="tapTime">10.0s</span><span id="tapScore">0 tap</span></div><div class="tap"><button id="tapBtn">TAP!</button></div></div></div>
</div>
</section>

<section id="music" class="page">
<div class="hero"><h1>🎵 WUNO Music</h1><p>Cari lagu dengan cepat dan buka hasilnya di Spotify. Playback tetap menggunakan Spotify milik pengguna.</p></div>
<div class="card musicbox"><div class="search"><input id="song" placeholder="Cari lagu, artis, atau album..."><button class="btn" onclick="searchSpotify()">Cari</button></div><div class="spotify"><div class="cover">♫</div><div><h2 style="margin:0 0 5px">Spotify</h2><div class="muted">Pilih lagu di Spotify untuk memulai pemutaran. Integrasi playback penuh memerlukan autentikasi Spotify resmi.</div><button class="btn green" style="margin-top:10px" onclick="searchSpotify()">Buka Spotify</button></div></div></div>
</section>

<div class="foot">WUNO • Game Center</div>
</div>
<script>
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));document.getElementById(t.dataset.p).classList.add('on')});
let board=Array(9).fill(''),over=false,turn='X';
function renderTTT(){const e=document.getElementById('ttt');e.innerHTML='';board.forEach((v,i)=>{const b=document.createElement('button');b.className='cell '+(v==='X'?'x':v==='O'?'o':'');b.textContent=v;b.onclick=()=>moveTTT(i);e.appendChild(b)})}
function wins(b,s){return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(a=>a.every(i=>b[i]===s))}
function resetTTT(){board=Array(9).fill('');over=false;turn='X';document.getElementById('tttStatus').textContent='Giliran kamu';renderTTT()}
function showTTT(){document.getElementById('tttBox').hidden=false;resetTTT()}
function moveTTT(i){if(over||board[i]||turn!=='X')return;board[i]='X';if(wins(board,'X')){over=true;document.getElementById('tttStatus').textContent='Kamu menang 🎉';return renderTTT()}if(board.every(Boolean)){over=true;document.getElementById('tttStatus').textContent='Seri';return renderTTT()}turn='O';document.getElementById('tttStatus').textContent='Bot berpikir...';renderTTT();setTimeout(botTTT,240)}
function botTTT(){if(over)return;const empty=board.map((v,i)=>v?null:i).filter(v=>v!==null);let p=empty.find(i=>{let b=[...board];b[i]='O';return wins(b,'O')});if(p===undefined)p=empty.find(i=>{let b=[...board];b[i]='X';return wins(b,'X')});if(p===undefined)p=board[4]===''?4:empty[Math.floor(Math.random()*empty.length)];board[p]='O';if(wins(board,'O')){over=true;document.getElementById('tttStatus').textContent='Bot menang'}else if(board.every(Boolean)){over=true;document.getElementById('tttStatus').textContent='Seri'}else{turn='X';document.getElementById('tttStatus').textContent='Giliran kamu'}renderTTT()}
renderTTT();
let end=0,score=0,timer=0,active=false;const tap=document.getElementById('tapBtn');tap.onclick=()=>{if(!active)return;if(performance.now()>=end)return;score++;document.getElementById('tapScore').textContent=score+' tap'};function startTap(){document.getElementById('tapBox').hidden=false;score=0;active=true;end=performance.now()+10000;document.getElementById('tapScore').textContent='0 tap';clearInterval(timer);timer=setInterval(()=>{let left=Math.max(0,end-performance.now())/1000;document.getElementById('tapTime').textContent=left.toFixed(1)+'s';if(left<=0){clearInterval(timer);active=false;document.getElementById('tapTime').textContent='Selesai!'}},50)}
function searchSpotify(){const q=document.getElementById('song').value.trim();window.open(q?'https://open.spotify.com/search/'+encodeURIComponent(q):'https://open.spotify.com','_blank')}
</script>
</body>
</html>`;