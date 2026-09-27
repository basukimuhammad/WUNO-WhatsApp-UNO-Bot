const SPOTIFY_PLAYER_BUILD = "WUNO-SPOTIFY-2026-09-27-R13";

type SpotifyHtmlTrack = { id: string; title: string; artist: string; album: string; duration: string; thumbnail: string | null; previewUrl: string | null; audioUrl?: string; };

function esc(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildSpotifyPlayerHtml(token: string, query: string, tracks: SpotifyHtmlTrack[]) {
  const t = tracks[0];
  console.info("[SPOTIFY-HTML] BUILD", {
    version: SPOTIFY_PLAYER_BUILD,
    trackId: t?.id || null,
    htmlVersion: "ws-chunk-blob-r13",
  });

  if (!t) {
    return '<html><body style="font-family:Arial;text-align:center;padding:30px">🎵 Lagu tidak ditemukan.</body></html>';
  }

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
<audio id="audio" controls preload="metadata"></audio>
<div class="info" id="info">⏳ Siap menyiapkan audio...</div>
<script>
(function () {
  const audio = document.getElementById("audio");
  const cover = document.getElementById("cover");
  const playBtn = document.getElementById("playBtn");
  const info = document.getElementById("info");
  const trackId = ${trackId};
  const wsUrl = __WUNO_WS_URL__;
  const apiOrigin = "__WUNO_API_ORIGIN__";
  const directAudioUrl = apiOrigin + "/api/spotify/audio/" + encodeURIComponent(trackId);
  const directCoverUrl = "__WUNO_API_ORIGIN__/api/spotify/cover/" + encodeURIComponent(trackId);

  let ws = null;
  let wsOpened = false;
  let requestSeq = 0;
  let wsPending = new Map();
  let blobUrl = null;
  let loading = false;
  let loaded = false;

  function log(label, extra) {
    try { console.log("[WUNO-SPOTIFY]", Object.assign({ label: label }, extra || {})); } catch (_) {}
  }

  function status(text) {
    info.textContent = text;
  }

  function requestId() {
    requestSeq += 1;
    return "spotify-" + Date.now() + "-" + requestSeq;
  }

  log("INIT", {
    origin: "__WUNO_API_ORIGIN__",
    wsUrl: wsUrl,
    directAudioUrl: directAudioUrl,
    directCoverUrl: directCoverUrl,
    trackId: trackId
  });

  cover.addEventListener("load", function () {
    log("COVER_LOAD", { width: cover.naturalWidth, height: cover.naturalHeight });
    status("🖼️ Cover siap");
  });

  cover.addEventListener("error", function () {
    log("COVER_ERROR");
    status("⚠️ Cover gagal dimuat");
  });

  audio.addEventListener("loadstart", function () {
    log("AUDIO_LOADSTART", { src: audio.src });
    status("⏳ Memuat audio...");
  });

  audio.addEventListener("loadedmetadata", function () {
    log("AUDIO_METADATA", {
      duration: audio.duration,
      readyState: audio.readyState,
      src: audio.src
    });
    status("▶️ Audio siap");
  });

  audio.addEventListener("canplay", function () {
    log("AUDIO_CANPLAY", { readyState: audio.readyState });
  });

  audio.addEventListener("playing", function () {
    log("AUDIO_PLAYING", { currentTime: audio.currentTime });
    status("▶️ Sedang diputar");
  });

  audio.addEventListener("pause", function () {
    log("AUDIO_PAUSE", { currentTime: audio.currentTime });
  });

  audio.addEventListener("stalled", function () {
    log("AUDIO_STALLED");
    status("⚠️ Audio macet");
  });

  audio.addEventListener("waiting", function () {
    log("AUDIO_WAITING");
  });

  audio.addEventListener("error", function () {
    const e = audio.error;
    log("AUDIO_ERROR", {
      code: e ? e.code : null,
      message: e ? e.message : null,
      networkState: audio.networkState,
      readyState: audio.readyState,
      src: audio.src
    });
    status("❌ Audio gagal dimuat");
    playBtn.disabled = false;
    playBtn.textContent = "▶ Coba putar lagi";
  });

  function toAbsoluteUrl(url) {
    if (!url) return "";
    if (/^https?:\\//i.test(url)) return url;
    return apiOrigin.replace(/\\/$/, "") + (url.startsWith("/") ? url : "/" + url);
  }

  function useAudio(url, source) {
    if (!url) throw new Error("URL audio kosong");
    log("SET_AUDIO", { source: source, url: url });
    audio.src = toAbsoluteUrl(url);
    audio.load();
    status("⏳ Audio ditemukan, memulai...");
    const p = audio.play();
    if (p && p.catch) {
      p.catch(function (err) {
        log("PLAY_REJECTED", {
          source: source,
          message: err && err.message ? err.message : String(err)
        });
        status("▶️ Tekan Play pada kontrol audio");
      });
    }
  }

  function fallbackDirect() {
    log("FALLBACK_DIRECT", { url: directAudioUrl });
    try {
      useAudio(directAudioUrl, "direct-api");
    } catch (err) {
      log("FALLBACK_FAILED", { message: String(err) });
      status("❌ Audio tidak tersedia");
      playBtn.disabled = false;
    }
  }

  function connectWebSocket() {
    return new Promise(function (resolve, reject) {
      if (!wsUrl || !window.WebSocket) {
        reject(new Error("WebSocket tidak tersedia"));
        return;
      }
      if (ws && ws.readyState === 1) {
        resolve();
        return;
      }

      try {
        log("WS_CONNECT", { url: wsUrl });
        ws = new WebSocket(wsUrl);
        const timer = setTimeout(function () {
          if (!wsOpened) reject(new Error("WebSocket timeout"));
        }, 15000);

        ws.onopen = function () {
          clearTimeout(timer);
          wsOpened = true;
          log("WS_OPEN");
          resolve();
        };

        ws.onmessage = function (event) {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (err) {
            log("WS_BAD_JSON", { message: String(err) });
            return;
          }
          const pending = data && data.requestId ? wsPending.get(data.requestId) : null;
          if (!pending) return;
          wsPending.delete(data.requestId);
          if (data.success) pending.resolve(data);
          else pending.reject(new Error(data.message || "Aksi Spotify gagal"));
        };

        ws.onerror = function () {
          wsOpened = false;
          log("WS_ERROR");
        };

        ws.onclose = function (event) {
          wsOpened = false;
          log("WS_CLOSE", { code: event.code, reason: event.reason || "" });
          wsPending.forEach(function (pending) {
            pending.reject(new Error("WebSocket terputus"));
          });
          wsPending.clear();
        };
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  function sendWsAction(action, timeoutMs) {
    return connectWebSocket().then(function () {
      return new Promise(function (resolve, reject) {
        const rid = requestId();
        const timer = setTimeout(function () {
          wsPending.delete(rid);
          reject(new Error("WebSocket timeout"));
        }, timeoutMs || 30000);
        wsPending.set(rid, {
          resolve: function (value) { clearTimeout(timer); resolve(value); },
          reject: function (error) { clearTimeout(timer); reject(error); }
        });
        try {
          ws.send(JSON.stringify(Object.assign({}, action, { requestId: rid })));
        } catch (err) {
          clearTimeout(timer);
          wsPending.delete(rid);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
  }

  function b64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function loadAudioFromWebSocket() {
    const meta = await sendWsAction({ type: "spotifyResolve", id: trackId }, 120000);
    if (meta.coverDataUrl) cover.src = meta.coverDataUrl;
    if (!meta.audioReady || !meta.audioTotal) {
      throw new Error("Server tidak menyiapkan audio");
    }

    const parts = new Array(meta.audioTotal);
    let next = 0;
    let completed = 0;
    let failure = null;

    async function worker() {
      while (!failure) {
        const n = next++;
        if (n >= meta.audioTotal) return;
        try {
          const part = await sendWsAction({
            type: "spotifyChunk",
            id: trackId,
            n
          }, 60000);
          parts[n] = b64ToBytes(part.data);
          completed++;
          status("⏳ Mengunduh audio " + Math.round(completed / meta.audioTotal * 100) + "%...");
        } catch (error) {
          failure = error instanceof Error ? error : new Error(String(error));
          return;
        }
      }
    }

    await Promise.all([
      worker(),
      worker(),
      worker()
    ]);
    if (failure) throw failure;

    if (blobUrl) {
      try { URL.revokeObjectURL(blobUrl); } catch (_) {}
    }
    blobUrl = URL.createObjectURL(new Blob(parts, {
      type: meta.audioMime || "audio/mpeg"
    }));
    return blobUrl;
  }

  async function startAudio() {
    if (loaded && blobUrl) {
      const p = audio.play();
      if (p && p.catch) p.catch(function () { status("▶️ Tekan Play pada kontrol audio"); });
      return;
    }
    if (loading) return;
    loading = true;
    playBtn.disabled = true;
    playBtn.textContent = "⏳ Menyiapkan...";

    log("PLAY_CLICK", { trackId: trackId });

    try {
      const audioUrl = await loadAudioFromWebSocket();
      useAudio(audioUrl, "websocket-blob");
      loaded = true;
      status("✅ Audio siap — tekan ▶ jika belum mulai");
    } catch (err) {
      log("WS_AUDIO_FAILED", {
        message: err && err.message ? err.message : String(err)
      });
      status("❌ Audio tidak tersedia: " + (err && err.message ? err.message : "gagal"));
    } finally {
      loading = false;
      playBtn.disabled = false;
      playBtn.textContent = "▶ Putar lagu";
    }
  }

  playBtn.addEventListener("click", startAudio);

  window.addEventListener("error", function (event) {
    log("WINDOW_ERROR", { message: event.message || null });
  });

  cover.src = directCoverUrl;
})();
</script>
</body></html>`;
}

export const SPOTIFY_PLAYER_HTML = "";