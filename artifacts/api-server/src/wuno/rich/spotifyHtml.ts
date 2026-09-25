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
  token: string,
  query: string,
  tracks: SpotifyHtmlTrack[],
) {
  const t = tracks[0];

  if (!t) {
    return '<!doctype html><html><body style="font-family:Arial;text-align:center;padding:30px">🎵 Lagu tidak ditemukan.</body></html>';
  }

  // SpotSaver sudah memberikan URL thumbnail dan previewUrl yang bisa dipakai langsung.
  const coverUrl = t.thumbnail || "";
  const audioUrl = t.previewUrl || "";

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
audio{width:100%;margin-top:8px}
.info{text-align:center;color:#777;font-size:10px;margin-top:10px}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="brand">♫ SPOTIFY</div>
    <div class="query">Hasil untuk: ${esc(query)}</div>
    <img class="cover" src="${esc(coverUrl)}" alt="">
    <div class="meta">
      <div class="title">${esc(t.title)}</div>
      <div class="artist">${esc(t.artist || "Unknown Artist")}${t.album ? " • " + esc(t.album) : ""}</div>
    </div>
    <audio controls preload="metadata" src="${esc(audioUrl)}"></audio>
    <div class="info">SpotSaver • previewUrl langsung</div>
  </div>
</div>
</body>
</html>`;
}

export const SPOTIFY_PLAYER_HTML = "";
