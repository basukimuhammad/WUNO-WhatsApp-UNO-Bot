type SpotifyHtmlTrack = {
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbnail: string | null;
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
  const t = encodeURIComponent(token);
  const cards = tracks.map((track, i) => {
    const stream = "__WUNO_API_ORIGIN__/api/spotify/stream?token=" + t + "&index=" + i;
    const send = "__WUNO_API_ORIGIN__/api/spotify/send?token=" + t + "&index=" + i;
    return '<div class="track">' +
      '<div class="row">' +
      '<img src="' + esc(track.thumbnail || "") + '">' +
      '<div class="info"><div class="title">' + esc(track.title) + '</div>' +
      '<div class="sub">' + esc(track.artist || "Unknown Artist") + ' • ' +
      esc(track.album || "Unknown Album") + ' • ' + esc(track.duration || "0:00") + '</div></div>' +
      '</div>' +
      '<audio controls preload="none" src="' + stream + '"></audio>' +
      '<a class="download" href="' + send + '" target="_blank" rel="noopener">Download</a>' +
      '</div>';
  }).join("");

  return '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    '*{box-sizing:border-box}body{margin:0;background:transparent;color:#fff;font-family:Arial,sans-serif}' +
    '.wrap{max-width:410px;margin:auto;padding:14px}.card{background:linear-gradient(180deg,#383838,#111 48%,#080808);border-radius:20px;padding:18px}' +
    '.brand{color:#1ed760;font-weight:900;letter-spacing:1px;font-size:13px;margin-bottom:8px}.query{color:#aaa;font-size:12px;margin-bottom:14px}' +
    '.track{background:#191919;border-radius:14px;padding:10px;margin-top:10px}.row{display:flex;gap:10px;align-items:center}.row img{width:55px;height:55px;border-radius:8px;object-fit:cover;background:#242424}' +
    '.info{min-width:0;flex:1}.title{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{font-size:11px;color:#aaa;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    'audio{width:100%;margin-top:10px}.download{display:block;width:max-content;margin:9px auto 0;padding:9px 16px;border-radius:11px;background:#fff;color:#000;text-decoration:none;font-weight:800}' +
    '</style></head><body><div class="wrap"><div class="card">' +
    '<div class="brand">♫ SPOTIFY</div><div class="query">Hasil: ' + esc(query) + '</div>' +
    (cards || '<div style="text-align:center;color:#aaa;padding:20px">Tidak ada hasil.</div>') +
    '</div></div></body></html>';
}

export const SPOTIFY_PLAYER_HTML = "";
