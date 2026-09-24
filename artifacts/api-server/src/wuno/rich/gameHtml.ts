export const WUNO_GAME_HTML = String.raw\`
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>WUNO Game Center</title>
<style>
*{box-sizing:border-box}html,body{margin:0;background:#07090d;color:#f7f8fb;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
body{padding:14px}.app{max-width:560px;margin:auto}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.brand{font-weight:900;font-size:20px}.muted{color:#8e98a8;font-size:12px}.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}
button{border:0;color:#fff;background:#171c26;border-radius:12px;padding:10px;font-weight:800;cursor:pointer}
button.on{background:#7357ff}.screen{display:none}.screen.on{display:block}.card{background:#11151d;border:1px solid #262d38;border-radius:18px;padding:14px;margin-bottom:10px}
h2,h3{margin:0 0 6px}.desc{color:#9ca6b5;font-size:12px;line-height:1.5}
.board{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;background:#05070a;padding:5px;border-radius:12px;max-width:360px;margin:12px auto}
.cell{aspect-ratio:1;padding:0;border-radius:3px;background:#111722;border:1px solid #1b2230}.filled{background:#765cff}.ghost{background:#2c274e}
.controls{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px}.controls button{padding:12px}
.ttt{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:300px;margin:12px auto}.ttt button{aspect-ratio:1;font-size:30px}
.tap{text-align:center;padding:24px 0}.tap button{width:170px;height:170px;border-radius:50%;font-size:25px;background:#7357ff}
.music input{width:100%;background:#090c12;border:1px solid #29313e;border-radius:12px;padding:12px;color:#fff;margin-bottom:8px}
.result{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px 0;border-top:1px solid #252b35}
.small{font-size:11px;color:#8f99a8}.score{font-size:22px;font-weight:900}
</style>
</head>
<body>
<div class="app">
  <div class="top"><div><div class="brand">🎮 WUNO Game Center</div><div class="muted">HTML interaktif • langsung di WhatsApp</div></div><div class="score" id="score">0</div></div>
  <div class="tabs">
    <button class="tab on" data-s="home">Home</button><button class="tab" data-s="tetris">Tetris</button><button class="tab" data-s="ttt">Tic-Tac-Toe</button><button class="tab" data-s="music">Music</button>
  </div>
  <section class="screen on" id="home"><div class="card"><h2>Selamat datang 👋</h2><div class="desc">Pilih permainan. Semua game berjalan di dalam tampilan HTML WUNO tanpa membuka halaman lain.</div></div><div class="card"><h3>🧱 Tetris</h3><div class="desc">Susun blok, bersihkan garis, dan kejar skor.</div><button style="margin-top:10px" onclick="show('tetris')">Main Tetris</button></div><div class="card"><h3>⭕ Tic-Tac-Toe</h3><div class="desc">Lawan bot dalam papan 3×3.</div><button style="margin-top:10px" onclick="show('ttt')">Main Tic-Tac-Toe</button></div><div class="card"><h3>⚡ Tap Rush</h3><div class="desc">Tes kecepatan jari selama 10 detik.</div><button style="margin-top:10px" onclick="show('tap')">Mulai Tap Rush</button></div></section>
  <section class="screen" id="tetris"><div class="card"><h2>🧱 Tetris</h2><div class="desc" id="tstat">Skor 0 • Level 1</div><div id="board" class="board"></div><div class="controls"><button onclick="move(-1)">←</button><button onclick="rotate()">↻</button><button onclick="drop()">↓</button><button onclick="hard()">⤓</button><button onclick="move(1)">→</button></div></div></section>
  <section class="screen" id="ttt"><div class="card"><h2>⭕ Tic-Tac-Toe</h2><div class="desc" id="tstatus">Giliran kamu</div><div id="tttboard" class="ttt"></div><button onclick="resetTTT()">Reset</button></div></section>
  <section class="screen" id="tap"><div class="card"><h2>⚡ Tap Rush</h2><div class="desc" id="tapstatus">Tekan mulai.</div><div class="tap"><button id="tapbtn" onclick="tap()">TAP!</button></div><button onclick="startTap()">Mulai 10 detik</button></div></section>
  <section class="screen" id="music"><div class="card music"><h2>🎵 Music</h2><div class="desc">Cari lagu dan buka hasilnya di Spotify.</div><input id="query" placeholder="Contoh: Nidji Laskar Pelangi"><button onclick="spotify()">Cari di Spotify</button><div id="results"></div></div></section>
</div>
<script>
const tabs=[...document.querySelectorAll('.tab')], screens=[...document.querySelectorAll('.screen')];
function show(id){screens.forEach(x=>x.classList.toggle('on',x.id===id));tabs.forEach(x=>x.classList.toggle('on',x.dataset.s===id))}
tabs.forEach(x=>x.onclick=()=>show(x.dataset.s));
let score=0;function addScore(n){score+=n;document.getElementById('score').textContent=score}

const W=10,H=20,shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
let grid=Array.from({length:H},()=>Array(W).fill(0)),piece,px,py,rotN=0,tScore=0,level=1,over=false,timer;
function newPiece(){let s=shapes[Math.floor(Math.random()*shapes.length)];piece=s.map(r=>[...r]);px=Math.floor((W-piece[0].length)/2);py=0;rotN=0;if(collide(0,0))over=true}
function cells(){return piece}
function collide(dx,dy,p=piece){return p.some((r,y)=>r.some((v,x)=>v&&(grid[py+y+dy]?.[px+x+dx]||px+x+dx<0||px+x+dx>=W||py+y+dy>=H)))}
function merge(){piece.forEach((r,y)=>r.forEach((v,x)=>{if(v&&py+y>=0)grid[py+y][px+x]=1}))}
function clearLines(){let n=0;grid=grid.filter(r=>{if(r.every(Boolean)){n++;return false}return true});while(grid.length<H)grid.unshift(Array(W).fill(0));if(n){tScore+=n*n*100;level=1+Math.floor(tScore/1000);addScore(n*10)}}
function drawBoard(){const b=document.getElementById('board');b.innerHTML='';for(let y=0;y<H;y++)for(let x=0;x<W;x++){let d=document.createElement('div');d.className='cell'+(grid[y][x]?' filled':'');b.appendChild(d)};piece?.forEach((r,y)=>r.forEach((v,x)=>{if(v&&py+y>=0){let i=(py+y)*W+px+x;b.children[i].classList.add('ghost')}}));document.getElementById('tstat').textContent=over?'Game Over • Skor '+tScore:'Skor '+tScore+' • Level '+level}
function step(){if(over)return; if(!collide(0,1))py++;else{merge();clearLines();newPiece()}drawBoard()}
function move(dx){if(!over&&!collide(dx,0))px+=dx;drawBoard()}
function rotate(){let old=piece;let p=piece[0].map((_,i)=>piece.map(r=>r[i]).reverse());piece=p;if(collide(0,0))piece=old;drawBoard()}
function drop(){while(!collide(0,1))py++;step()}
function hard(){drop()}
function startTetris(){grid=Array.from({length:H},()=>Array(W).fill(0));tScore=0;level=1;over=false;newPiece();clearInterval(timer);timer=setInterval(step,650);drawBoard()}
startTetris();

let tb=['','','','','','','','',''],turn='X',tdone=false;
function renderTTT(){let el=document.getElementById('tttboard');el.innerHTML='';tb.forEach((v,i)=>{let b=document.createElement('button');b.textContent=v;b.onclick=()=>ttmove(i);el.appendChild(b)})}
function tw(b,s){return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(a=>a.every(i=>b[i]===s))}
function resetTTT(){tb=['','','','','','','','',''];turn='X';tdone=false;document.getElementById('tstatus').textContent='Giliran kamu';renderTTT()}
function ttmove(i){if(tdone||tb[i])return;tb[i]='X';if(tw(tb,'X'))return endTT('Kamu menang 🎉');if(tb.every(Boolean))return endTT('Seri');turn='O';document.getElementById('tstatus').textContent='Bot berpikir...';renderTTT();setTimeout(bot,250)}
function bot(){let e=tb.map((v,i)=>v?null:i).filter(i=>i!==null);let p=e.find(i=>{let b=[...tb];b[i]='O';return tw(b,'O')});if(p===undefined)p=e.find(i=>{let b=[...tb];b[i]='X';return tw(b,'X')});if(p===undefined)p=tb[4]===''?4:e[Math.floor(Math.random()*e.length)];tb[p]='O';if(tw(tb,'O'))return endTT('Bot menang');if(tb.every(Boolean))return endTT('Seri');turn='X';document.getElementById('tstatus').textContent='Giliran kamu';renderTTT()}
function endTT(s){tdone=true;document.getElementById('tstatus').textContent=s;renderTTT();if(s.includes('Kamu'))addScore(100)}
resetTTT();

let tapActive=false,tapCount=0,tapEnd=0,tapInterval;
function startTap(){tapCount=0;tapActive=true;tapEnd=Date.now()+10000;document.getElementById('tapstatus').textContent='GO!';clearInterval(tapInterval);tapInterval=setInterval(()=>{let left=Math.max(0,tapEnd-Date.now());document.getElementById('tapstatus').textContent=(left/1000).toFixed(1)+'s • '+tapCount+' tap';if(left<=0){tapActive=false;clearInterval(tapInterval);addScore(tapCount);document.getElementById('tapstatus').textContent='Selesai! '+tapCount+' tap'}},50)}
function tap(){if(tapActive&&Date.now()<tapEnd)tapCount++}
function spotify(){let q=document.getElementById('query').value.trim();if(!q)return;let url='https://open.spotify.com/search/'+encodeURIComponent(q);document.getElementById('results').innerHTML='<div class="result"><span>'+q.replace(/[<>&]/g,'')+'</span><button onclick="window.open(\''+url+'\',\'_blank\')">Buka Spotify</button></div>'}
</script>
</body>
</html>`;

// sendHtmlApp injects the HTML primitive into AIRichResponseMessage.
// The socket is intentionally separate from whatsapp-web.js because WUNO's
// existing transport does not expose relayMessage/AIRichResponseMessage.
