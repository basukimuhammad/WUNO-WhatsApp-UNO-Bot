type SpotifyHtmlTrack = { id: string; title: string; artist: string; album: string; duration: string; thumbnail: string | null; previewUrl: string | null; audioUrl?: string; };

function esc(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildSpotifyPlayerHtml(token: string, query: string, tracks: SpotifyHtmlTrack[]) {
  const t = tracks[0];
  if (!t) return '<html><body style="font-family:Arial;text-align:center;padding:30px">🎵 Lagu tidak ditemukan.</body></html>';
  const trackId = JSON.stringify(t.id);
  const initialCover = t.thumbnail
    ? "__WUNO_API_ORIGIN__/api/spotify/cover/" + encodeURIComponent(t.id)
    : "";

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;background:transparent;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.wrap{width:100%;max-width:410px;margin:auto;padding:14px}.card{background:linear-gradient(180deg,#383838 0%,#151515 48%,#090909 100%);border-radius:20px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.45)}.brand{color:#1ed760;font-size:14px;font-weight:900;letter-spacing:1px;margin-bottom:12px}.query{text-align:center;color:#aaa;font-size:11px;margin-bottom:12px}.cover{width:100%;aspect-ratio:1;display:block;object-fit:cover;border-radius:14px;background:#242424}.meta{text-align:center;padding:12px 4px}.title{font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.artist{font-size:12px;color:#aaa;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}button{width:100%;margin-top:10px;border:0;border-radius:999px;padding:13px 18px;background:#1ed760;color:#000;font-size:15px;font-weight:800}button:disabled{opacity:.55}audio{width:100%;margin-top:10px}.info{text-align:center;color:#777;font-size:10px;margin-top:10px;min-height:14px}</style>
</head><body><div class="wrap"><div class="card">
<div class="brand">♫ SPOTIFY</div>
<div class="query">Hasil untuk: ${esc(query)}</div>
<img class="cover" id="cover" src="${esc(initialCover)}" alt="">
<div class="meta"><div class="title" id="title">${esc(t.title)}</div><div class="artist" id="artist">${esc(t.artist || "Unknown Artist")}${t.album ? " • " + esc(t.album) : ""}</div></div>
<button id="playBtn" type="button">▶ Putar lagu</button>
<audio id="audio" controls preload="none"></audio>
<div class="info" id="info">Spotify • siap diputar</div>
<script>
(function () {
  const audio = document.getElementById("audio");
  const cover = document.getElementById("cover");
  const info = document.getElementById("info");
  const audioUrl = "__WUNO_API_ORIGIN__/api/spotify/audio/" + encodeURIComponent(${trackId});
  const coverUrl = "__WUNO_API_ORIGIN__/api/spotify/cover/" + encodeURIComponent(${trackId});

  function log(label, extra) {
    try { console.log("[WUNO-SPOTIFY]", Object.assign({ label: label }, extra || {})); } catch (_) {}
  }
  function status(text) { info.textContent = text; }

  log("INIT", { origin: "__WUNO_API_ORIGIN__", audioUrl: audioUrl, coverUrl: coverUrl });

  cover.addEventListener("load", function () {
    log("COVER_LOAD", { width: cover.naturalWidth, height: cover.naturalHeight });
  });
  cover.addEventListener("error", function () {
    log("COVER_ERROR");
    status("⚠️ Cover gagal dimuat");
  });

  audio.addEventListener("loadstart", function () { log("AUDIO_LOADSTART"); status("⏳ Memuat audio..."); });
  audio.addEventListener("loadedmetadata", function () {
    log("AUDIO_METADATA", { duration: audio.duration, readyState: audio.readyState });
    status("▶️ Audio siap");
  });
  audio.addEventListener("canplay", function () { log("AUDIO_CANPLAY", { readyState: audio.readyState }); });
  audio.addEventListener("playing", function () { log("AUDIO_PLAYING", { currentTime: audio.currentTime }); status("▶️ Sedang diputar"); });
  audio.addEventListener("pause", function () { log("AUDIO_PAUSE", { currentTime: audio.currentTime }); });
  audio.addEventListener("stalled", function () { log("AUDIO_STALLED"); status("⚠️ Audio macet"); });
  audio.addEventListener("waiting", function () { log("AUDIO_WAITING"); });
  audio.addEventListener("error", function () {
    const e = audio.error;
    log("AUDIO_ERROR", {
      code: e ? e.code : null,
      message: e ? e.message : null,
      networkState: audio.networkState,
      readyState: audio.readyState
    });
    status("❌ Audio gagal dimuat");
  });

  function startAudio(source) {
    log("PLAY_CLICK", { source: source || "unknown" });
    status("⏳ Menghubungi server audio...");
    if (audio.src !== audioUrl) {
      log("SET_SRC", { url: audioUrl });
      audio.src = audioUrl;
      audio.load();
    }
    const promise = audio.play();
    if (promise && promise.catch) {
      promise.catch(function (err) {
        log("PLAY_REJECTED", { message: err && err.message ? err.message : String(err) });
        status("⚠️ Tekan Play pada kontrol audio");
      });
    }
  }

  document.getElementById("playBtn").addEventListener("click", function () {
    startAudio("button");
  });

  audio.addEventListener("play", function () {
    log("NATIVE_PLAY_EVENT");
  });

  window.addEventListener("error", function (event) {
    log("WINDOW_ERROR", { message: event.message || null });
  });

  cover.src = coverUrl;
})();
</script>
</body></html>`;
}

export const SPOTIFY_PLAYER_HTML = "";