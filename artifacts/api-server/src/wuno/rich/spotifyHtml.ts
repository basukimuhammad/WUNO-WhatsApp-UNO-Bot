const SPOTIFY_PLAYER_BUILD = "WUNO-SPOTIFY-2026-09-28-R14";

type SpotifyHtmlTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbnail: string | null;
  previewUrl: string | null;
};

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildSpotifyPlayerHtml(
  _token: string,
  query: string,
  tracks: SpotifyHtmlTrack[],
) {
  const t = tracks[0];

  console.info("[SPOTIFY-HTML] BUILD", {
    version: SPOTIFY_PLAYER_BUILD,
    trackId: t?.id || null,
    transport: "websocket-blob",
  });

  if (!t) {
    return '<!doctype html><html><body style="font-family:Arial;text-align:center;padding:30px">🎵 Lagu tidak ditemukan.</body></html>';
  }

  const trackId = JSON.stringify(String(t.id));

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}
body{margin:0;background:transparent;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.wrap{width:100%;max-width:410px;margin:auto;padding:14px}
.card{background:linear-gradient(180deg,#383838 0%,#151515 48%,#090909 100%);border-radius:20px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.brand{color:#1ed760;font-size:14px;font-weight:900;letter-spacing:1px;margin-bottom:12px}
.query{text-align:center;color:#aaa;font-size:11px;margin-bottom:12px}
.cover{width:100%;aspect-ratio:1;display:block;object-fit:cover;border-radius:14px;background:#242424}
.meta{text-align:center;padding:12px 4px}
.title{font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.artist{font-size:12px;color:#aaa;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button,a.download{display:block;width:100%;margin-top:10px;border:0;border-radius:999px;padding:13px 18px;background:#1ed760;color:#000;font-size:15px;font-weight:800;text-align:center;text-decoration:none;cursor:pointer}
button:disabled{opacity:.55}
a.download{background:#2b2b2b;color:#fff}
audio{width:100%;margin-top:10px}
.info{text-align:center;color:#999;font-size:10px;margin-top:10px;min-height:16px;line-height:1.4}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="brand">♫ SPOTIFY</div>
    <div class="query">Hasil untuk: ${esc(query)}</div>
    <img class="cover" id="cover" alt="">
    <div class="meta">
      <div class="title" id="title">${esc(t.title)}</div>
      <div class="artist" id="artist">${esc(t.artist || "Unknown Artist")}${t.album ? " • " + esc(t.album) : ""}</div>
    </div>
    <button id="playBtn" type="button">▶ Putar lagu</button>
    <audio id="audio" controls preload="metadata"></audio>
    <a id="downloadBtn" class="download" href="#" download="Spotify.mp3" style="display:none">⬇️ Download MP3</a>
    <div class="info" id="info">Menyiapkan koneksi audio...</div>
  </div>
</div>

<script>
(function () {
  const audio = document.getElementById("audio");
  const cover = document.getElementById("cover");
  const playBtn = document.getElementById("playBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const info = document.getElementById("info");

  const trackId = ${trackId};
  const wsUrl = normalizeWebSocketUrl(__WUNO_WS_URL__);

  let ws = null;
  let requestSeq = 0;
  let pending = new Map();
  let blobUrl = null;
  let loading = false;
  let loaded = false;

  function log(label, extra) {
    try {
      console.log("[WUNO-SPOTIFY]", Object.assign({ label: label }, extra || {}));
    } catch (_) {}
  }

  function status(text) {
    info.textContent = text;
  }

  function normalizeWebSocketUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, window.location.href);
      if (parsed.protocol === "http:") parsed.protocol = "ws:";
      if (parsed.protocol === "https:") parsed.protocol = "wss:";
      if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
        throw new Error("Protokol WebSocket tidak valid");
      }
      return parsed.toString();
    } catch (err) {
      log("WS_URL_INVALID", { value: raw, message: String(err) });
      return "";
    }
  }

  function requestId() {
    requestSeq += 1;
    return "spotify-" + Date.now() + "-" + requestSeq;
  }

  function connectWebSocket() {
    return new Promise(function (resolve, reject) {
      if (!wsUrl) {
        reject(new Error("URL WebSocket kosong"));
        return;
      }

      if (typeof WebSocket === "undefined") {
        reject(new Error("WebSocket tidak tersedia"));
        return;
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      let settled = false;
      let timer = null;

      const finish = function (fn, value) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        fn(value);
      };

      timer = setTimeout(function () {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        finish(reject, new Error("WebSocket timeout"));
      }, 15000);

      try {
        log("WS_CONNECT", { url: wsUrl });
        ws = new WebSocket(wsUrl);

        ws.onopen = function () {
          log("WS_OPEN");
          finish(resolve);
        };

        ws.onmessage = function (event) {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (err) {
            log("WS_BAD_JSON", { message: String(err) });
            return;
          }

          const id = data && data.requestId ? String(data.requestId) : "";
          const item = id ? pending.get(id) : null;
          if (!item) return;

          pending.delete(id);

          if (data.success) item.resolve(data);
          else item.reject(new Error(data.message || "Aksi Spotify gagal"));
        };

        ws.onerror = function () {
          log("WS_ERROR");
          if (!settled) finish(reject, new Error("WebSocket error"));
        };

        ws.onclose = function (event) {
          log("WS_CLOSE", {
            code: event.code,
            reason: event.reason || ""
          });

          pending.forEach(function (item) {
            item.reject(new Error("WebSocket terputus"));
          });
          pending.clear();

          if (!settled) {
            finish(reject, new Error("WebSocket ditutup sebelum terbuka"));
          }
        };
      } catch (err) {
        finish(reject, err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  function sendWsAction(action, timeoutMs) {
    return connectWebSocket().then(function () {
      return new Promise(function (resolve, reject) {
        const id = requestId();

        const timer = setTimeout(function () {
          pending.delete(id);
          reject(new Error("WebSocket request timeout"));
        }, timeoutMs || 60000);

        pending.set(id, {
          resolve: function (value) {
            clearTimeout(timer);
            resolve(value);
          },
          reject: function (error) {
            clearTimeout(timer);
            reject(error);
          }
        });

        try {
          ws.send(JSON.stringify(Object.assign({}, action, { requestId: id })));
        } catch (err) {
          clearTimeout(timer);
          pending.delete(id);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
  }

  function b64ToBytes(value) {
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function loadTrackOverWebSocket() {
    status("⏳ Mencari sumber audio...");
    log("RESOLVE_START", { trackId: trackId });

    const meta = await sendWsAction(
      { type: "spotifyResolve", id: trackId },
      180000
    );

    const total = Number(meta.audioTotal || meta.total || 0);
    const size = Number(meta.audioSize || meta.size || 0);
    const mime = String(meta.audioMime || meta.mime || "audio/mpeg");

    log("RESOLVE_RESULT", {
      trackId: trackId,
      audioSize: size,
      audioTotal: total,
      audioMime: mime,
      hasCover: Boolean(meta.coverDataUrl)
    });

    if (meta.coverDataUrl) {
      cover.src = meta.coverDataUrl;
      log("COVER_READY", { embedded: true });
    }

    if (!Number.isFinite(total) || total <= 0) {
      throw new Error("Server tidak menyiapkan audio");
    }

    const parts = new Array(total);
    let next = 0;
    let completed = 0;
    let failure = null;

    async function worker() {
      while (!failure) {
        const n = next++;
        if (n >= total) return;

        try {
          const part = await sendWsAction(
            { type: "spotifyChunk", id: trackId, n: n },
            90000
          );

          if (!part.data) {
            throw new Error("Chunk audio kosong");
          }

          parts[n] = b64ToBytes(part.data);
          completed += 1;

          status(
            "⏳ Memuat audio " +
            Math.round((completed / total) * 100) +
            "%"
          );

          log("CHUNK_OK", {
            n: n,
            total: total,
            completed: completed,
            bytes: parts[n].byteLength
          });
        } catch (err) {
          failure = err instanceof Error ? err : new Error(String(err));
          log("CHUNK_FAIL", { n: n, message: failure.message });
          return;
        }
      }
    }

    await Promise.all([worker(), worker(), worker()]);

    if (failure) throw failure;

    const blob = new Blob(parts, { type: mime });

    if (!blob.size) {
      throw new Error("Audio kosong setelah digabung");
    }

    if (blobUrl) {
      try { URL.revokeObjectURL(blobUrl); } catch (_) {}
    }

    blobUrl = URL.createObjectURL(blob);
    audio.src = blobUrl;
    audio.load();

    downloadBtn.href = blobUrl;
    downloadBtn.download =
      ((String(document.getElementById("title").textContent || "Spotify")
        .replace(/[\\/:*?"<>|]/g, " ")
        .trim()) || "Spotify") + ".mp3";
    downloadBtn.style.display = "block";

    log("AUDIO_BLOB_READY", {
      size: blob.size,
      mime: mime,
      urlCreated: Boolean(blobUrl)
    });

    status("✅ Audio siap");
    return blobUrl;
  }

  async function playCurrentAudio() {
    try {
      const p = audio.play();
      if (p && p.catch) await p.catch(function (err) {
        log("PLAY_REJECTED", {
          message: err && err.message ? err.message : String(err)
        });
      });
    } catch (err) {
      log("PLAY_ERROR", { message: String(err) });
    }
  }

  playBtn.addEventListener("click", async function () {
    if (loading) return;

    if (loaded && blobUrl) {
      await playCurrentAudio();
      return;
    }

    loading = true;
    playBtn.disabled = true;
    playBtn.textContent = "⏳ Menyiapkan...";

    try {
      await loadTrackOverWebSocket();
      loaded = true;
      await playCurrentAudio();
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      log("PLAYER_FAILED", { message: message });
      status("❌ " + message);
    } finally {
      loading = false;
      playBtn.disabled = false;
      playBtn.textContent = loaded ? "▶ Putar lagi" : "▶ Coba lagi";
    }
  });

  audio.addEventListener("loadedmetadata", function () {
    log("AUDIO_METADATA", {
      duration: audio.duration,
      readyState: audio.readyState
    });
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      status("▶️ Audio siap");
    }
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

  audio.addEventListener("error", function () {
    const e = audio.error;
    log("AUDIO_ERROR", {
      code: e ? e.code : null,
      message: e ? e.message : null,
      networkState: audio.networkState,
      readyState: audio.readyState
    });
    status("❌ Audio gagal diputar");
  });

  window.addEventListener("error", function (event) {
    log("WINDOW_ERROR", {
      message: event.message || null
    });
  });

  log("INIT", {
    version: "WUNO-SPOTIFY-2026-09-28-R14",
    trackId: trackId,
    wsUrl: wsUrl
  });

  if (!wsUrl) {
    status("❌ URL WebSocket tidak tersedia");
  }
})();
</script>
</body>
</html>`;
}

export const SPOTIFY_PLAYER_HTML = "";
