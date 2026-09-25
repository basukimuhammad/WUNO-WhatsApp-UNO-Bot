type SpotifyHtmlTrack = {
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbnail: string | null;
};

function escHtml(value: unknown) {
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
  const safeToken = encodeURIComponent(token);
  const items = tracks
    .map((t, i) => {
      const stream =
        "__WUNO_API_ORIGIN__/api/spotify/stream?token=" +
        safeToken +
        "&index=" +
        i;
      const send =
        "__WUNO_API_ORIGIN__/api/spotify/send?token=" +
        safeToken +
        "&index=" +
        i;

      return `
        <div class="track">
          <div class="track-head">
            <img src="${escHtml(t.thumbnail || "")}" alt="">
            <div class="info">
              <div class="title">${escHtml(t.title)}</div>
              <div class="sub">${escHtml(t.artist || "Unknown Artist")} • ${escHtml(t.album || "Unknown Album")} • ${escHtml(t.duration || "0:00")}</div>
            </div>
          </div>
          <audio controls preload="none" src="${stream}"></audio>
          <a class="send" href="${send}" target="_blank" rel="noopener">Download</a>
        </div>`;
    })
    .join("");

  const first = tracks[0];

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}
body{margin:0;background:transparent;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.wrap{max-width:410px;margin:auto;padding:14px}
.card{background:linear-gradient(180deg,#383838,#121212 46%,#0b0b0b);border-radius:20px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.brand{display:flex;align-items:center;gap:8px;color:#1ed760;font-size:12px;font-weight:900;letter-spacing:1px;margin-bottom:12px}
.brand b{font-size:20px}
.query{font-size:12px;color:#aaa;margin-bottom:14px}
.hero{background:#191919;border-radius:14px;padding:12px;margin-bottom:12px}
.cover{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;background:#242424}
.hero-title{font-size:18px;font-weight:900;margin-top:11px;text-align:center}
.hero-sub{font-size:12px;color:#aaa;margin-top:4px;text-align:center}
audio{width:100%;margin-top:12px;height:40px}
.send{display:block;width:max-content;margin:12px auto 0;background:#fff;color:#000;text-decoration:none;font-weight:900;padding:10px 18px;border-radius:12px}
.results{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.track{background:#191919;border-radius:14px;padding:10px}
.track-head{display:flex;gap:10px;align-items:center}
.track-head img{width:54px;height:54px;border-radius:8px;object-fit:cover;background:#242424}
.info{min-width:0;flex:1}
.title{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{font-size:11px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
.track audio{margin-top:9px}
.track .send{margin:9px auto 0}
.empty{text-align:center;color:#aaa;padding:20px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="brand"><b>♫</b> SPOTIFY</div>
    <div class="query">Hasil SpotSaver untuk: ${escHtml(query)}</div>
    ${first ? `
      <div class="hero">
        <img class="cover" src="${escHtml(first.thumbnail || "")}" alt="">
        <div class="hero-title">${escHtml(first.title)}</div>
        <div class="hero-sub">${escHtml(first.artist || "Unknown Artist")}</div>
        <audio controls preload="none" src="__WUNO_API_ORIGIN__/api/spotify/stream?token=${safeToken}&index=0"></audio>
        <a class="send" href="__WUNO_API_ORIGIN__/api/spotify/send?token=${safeToken}&index=0" target="_blank" rel="noopener">Download</a>
      </div>` : ""}
    <div class="results">
      ${items || '<div class="empty">Tidak ada hasil.</div>'}
    </div>
  </div>
</div>
</body>
</html>`;
}

export const SPOTIFY_PLAYER_HTML = "";
