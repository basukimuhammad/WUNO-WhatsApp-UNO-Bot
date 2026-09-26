const SPOTIFY_PLAYER_BUILD = "WUNO-SPOTIFY-2026-09-26-R10";

type SpotifyHtmlTrack = { id: string; title: string; artist: string; album: string; duration: string; thumbnail: string | null; previewUrl: string | null; audioUrl?: string; audioDataUrl?: string; coverDataUrl?: string | null; };

function esc(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildSpotifyPlayerHtml(token: string, query: string, tracks: SpotifyHtmlTrack[]) {
  const t = tracks[0];

  console.info("[SPOTIFY-HTML] BUILD", {
    version: SPOTIFY_PLAYER_BUILD,
    trackId: t?.id || null,
    htmlVersion: "embedded-media-r13",
  });

  if (!t) {
    return '<div style="font-family:Arial;text-align:center;padding:30px">🎵 Lagu tidak ditemukan.</div>';
  }

  const trackId = String(t.id);
  const coverUrl = t.coverDataUrl || "";
  const audioUrl = t.audioDataUrl || "";

  return `<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:transparent;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#fff}
.wrap{width:100%;max-width:400px;margin:auto;padding:14px}
.card{background:linear-gradient(180deg,#3a3a3a 0%,#121212 45%);border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5);padding:20px}
.brand{display:flex;align-items:center;font-size:12px;font-weight:700;letter-spacing:1px;color:#1DB954;margin-bottom:14px}
.cover-wrap{position:relative;width:100%;height:0;padding-top:100%;border-radius:12px;overflow:hidden;background:#282828}
.cover-wrap img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block}
.meta{margin-top:16px;text-align:center}
.title{font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.artist{font-size:13px;color:#b3b3b3;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
audio{display:block;width:100%;margin-top:18px}
.status{text-align:center;color:#777;font-size:10px;margin-top:12px}
</style>
<div class="wrap">
  <div class="card">
    <div class="brand">♫ SPOTIFY</div>
    <div class="cover-wrap">
      <img src="${esc(coverUrl)}" alt="">
    </div>
    <div class="meta">
      <div class="title">${esc(t.title)}</div>
      <div class="artist">${esc(t.artist || "Unknown Artist")}${t.album ? " • " + esc(t.album) : ""}</div>
    </div>
    <audio controls preload="metadata" src="${esc(audioUrl)}"></audio>
    <div class="status">Spotify • preview tertanam di Rich HTML</div>
  </div>
</div>`;
}

export const SPOTIFY_PLAYER_HTML = "";