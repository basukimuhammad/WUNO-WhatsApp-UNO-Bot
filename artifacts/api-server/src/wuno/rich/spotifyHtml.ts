type SpotifyHtmlTrack = { id: string; title: string; artist: string; album: string; duration: string; thumbnail: string | null; previewUrl: string | null; };

function esc(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildSpotifyPlayerHtml(token: string, query: string, tracks: SpotifyHtmlTrack[]) {
  const t = tracks[0];
  if (!t) return '<html><body style="font-family:Arial;text-align:center;padding:30px">🎵 Lagu tidak ditemukan.</body></html>';
  const trackId = JSON.stringify(t.id);
  const initialCover = t.thumbnail ? "__WUNO_API_ORIGIN__/api/spotify/proxy?url=" + encodeURIComponent(t.thumbnail) + "&ref=" + encodeURIComponent("https://open.spotify.com/") : "";

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;background:transparent;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.wrap{width:100%;max-width:410px;margin:auto;padding:14px}.card{background:linear-gradient(180deg,#383838 0%,#151515 48%,#090909 100%);border-radius:20px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.45)}.brand{color:#1ed760;font-size:14px;font-weight:900;letter-spacing:1px;margin-bottom:12px}.query{text-align:center;color:#aaa;font-size:11px;margin-bottom:12px}.cover{width:100%;aspect-ratio:1;display:block;object-fit:cover;border-radius:14px;background:#242424}.meta{text-align:center;padding:12px 4px}.title{font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.artist{font-size:12px;color:#aaa;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}button{width:100%;margin-top:10px;border:0;border-radius:999px;padding:13px 18px;background:#1ed760;color:#000;font-size:15px;font-weight:800}button:disabled{opacity:.55}audio{width:100%;margin-top:10px}.info{text-align:center;color:#777;font-size:10px;margin-top:10px;min-height:14px}</style>
</head><body><div class="wrap"><div class="card">
<div class="brand">♫ SPOTIFY</div>
<div class="query">Hasil untuk: ${esc(query)}</div>
<img class="cover" id="cover" src="${esc(initialCover)}" alt="">
<div class="meta"><div class="title" id="title">${esc(t.title)}</div><div class="artist" id="artist">${esc(t.artist || "Unknown Artist")}${t.album ? " • " + esc(t.album) : ""}</div></div>
<button id="playButton" type="button">▶️ Putar lagu</button>
<audio id="audio" controls preload="none" style="display:none"></audio>
<div class="info" id="info">Tekan tombol ▶️ untuk menyiapkan audio</div>
</div></div>
<script>
(function(){
var audio=document.getElementById("audio"),playButton=document.getElementById("playButton"),cover=document.getElementById("cover"),info=document.getElementById("info"),resolving=false,resolved=false,trackId=${trackId},apiOrigin="__WUNO_API_ORIGIN__";
function setInfo(t){if(info)info.textContent=t}
function resolve(){
 if(resolving||resolved)return;
 resolving=true;
 if(playButton){playButton.disabled=true;playButton.textContent="⏳ Menyiapkan...";}
 setInfo("⏳ Menyiapkan audio...");
 var url=apiOrigin+"/api/spotify/stream?id="+encodeURIComponent(trackId);
 audio.src=url;
 audio.style.display="block";
 if(playButton)playButton.style.display="none";
 audio.load();
 resolved=true;
 resolving=false;
 setInfo("▶️ Audio siap diputar");
 audio.play().catch(function(){setInfo("▶️ Audio siap — tekan Play di kontrol audio")});
}
if(playButton)playButton.addEventListener("click",resolve);
})();
</script></body></html>`;
}

export const SPOTIFY_PLAYER_HTML = "";