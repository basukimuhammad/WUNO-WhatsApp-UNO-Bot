import { createServer } from "node:http";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import yts from "yt-search";
import ytdl from "ytdl-core";
import { roomState, getSpotifyLiveRoom, joinSpotifyLiveRoom, leaveSpotifyLiveRoom, spotifyLiveRoomIsHost, setSpotifyLiveTrack, toggleSpotifyLive, syncSpotifyLive, sendSpotifyLive, touchSpotifyLiveMember, addSpotifyLiveChat, type SpotifyLiveMember } from "./wuno/spotifyLive/runtime";
import app from "./app";
import { logger } from "./lib/logger";
import { getSpotifyAudio, getSpotifyAudioById, getSpotifyAudioChunkById, getSpotifyAudioMetaById, getSpotifyCoverDataById, resolveSpotifyHtmlAudio, getSpotifyTrack, getSpotifyTrackById, resolveSpotifyTrack, sendSpotifyTrack, spotifySearch } from "./wuno/spotify";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/games" });

// --- Spotify biasa ---
function isPrivateIp(ip: string) {
  const type = isIP(ip);
  if (type === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    );
  }
  return true;
}

async function isSafeProxyHost(hostname: string) {
  if (isIP(hostname)) return !isPrivateIp(hostname);
  try {
    const results = await dnsLookup(hostname, { all: true, verbatim: true });
    return results.length > 0 && results.every((item) => !isPrivateIp(item.address));
  } catch {
    return false;
  }
}

app.get("/api/spotify/proxy", async (req, res) => {
  const rawUrl = String(req.query.url || "").trim();
  const ref = String(req.query.ref || "").trim();
  const startedAt = Date.now();
  logger.info({
    rawUrl,
    ref,
    range: String(req.headers.range || "") || null,
    userAgent: String(req.headers["user-agent"] || "") || null,
  }, "[SPOTIFY-PROXY] START");

  if (!rawUrl) {
    logger.error("[SPOTIFY-PROXY] FAIL missing url");
    return res.status(400).type("text/plain").send("url wajib diisi");
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch (error) {
    logger.error({ rawUrl, err: error }, "[SPOTIFY-PROXY] FAIL invalid URL");
    return res.status(400).type("text/plain").send("url tidak valid");
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    logger.error({ rawUrl, protocol: target.protocol }, "[SPOTIFY-PROXY] FAIL protocol");
    return res.status(400).type("text/plain").send("protocol tidak valid");
  }

  if (!(await isSafeProxyHost(target.hostname))) {
    logger.warn({ host: target.hostname }, "[SPOTIFY-PROXY] Host ditolak");
    logger.error({ host: target.hostname }, "[SPOTIFY-PROXY] FAIL host blocked");
    return res.status(403).type("text/plain").send("host tidak diizinkan");
  }

  const range = String(req.headers.range || "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*",
    };

    if (ref) headers.Referer = ref;
    if (range) headers.Range = range;

    logger.info({ target: target.toString(), headers }, "[SPOTIFY-PROXY] FETCH UPSTREAM");
    let upstream = await fetch(target, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    logger.info({
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      length: upstream.headers.get("content-length"),
      range: upstream.headers.get("content-range"),
      finalUrl: upstream.url,
    }, "[SPOTIFY-PROXY] UPSTREAM RESPONSE");
    if ([400, 401, 403].includes(upstream.status)) {
      const retryHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0",
        Accept: "*/*",
      };
      if (range) retryHeaders.Range = range;
      logger.warn({ status: upstream.status }, "[SPOTIFY-PROXY] RETRY UPSTREAM");
      upstream = await fetch(target, {
        headers: retryHeaders,
        redirect: "follow",
        signal: controller.signal,
      });
    }

    logger.info({
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      length: upstream.headers.get("content-length"),
      contentRange: upstream.headers.get("content-range"),
      acceptRanges: upstream.headers.get("accept-ranges"),
      finalUrl: upstream.url,
      elapsedMs: Date.now() - startedAt,
    }, "[SPOTIFY-PROXY] FINAL UPSTREAM");
    if (!upstream.ok && upstream.status !== 206) {
      logger.error({ status: upstream.status, body: await upstream.text().catch(() => "") }, "[SPOTIFY-PROXY] FAIL upstream");
      return res.status(502).type("text/plain").send("Upstream HTTP " + upstream.status);
    }

    const upstreamType = (upstream.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const cleanUrl = rawUrl.toLowerCase().split("?")[0];
    let contentType = upstreamType;

    if (
      !contentType ||
      contentType === "application/octet-stream" ||
      contentType === "binary/octet-stream" ||
      contentType === "text/plain"
    ) {
      if (/\.mp3$/.test(cleanUrl) || /[?&]f=mp3(?:&|$)/i.test(rawUrl)) {
        contentType = "audio/mpeg";
      } else if (/\.(m4a|mp4a)$/.test(cleanUrl)) {
        contentType = "audio/mp4";
      } else if (/\.ogg$/.test(cleanUrl)) {
        contentType = "audio/ogg";
      } else if (/\.(png)$/.test(cleanUrl)) {
        contentType = "image/png";
      } else if (/\.(jpe?g)$/.test(cleanUrl)) {
        contentType = "image/jpeg";
      } else if (/\.webp$/.test(cleanUrl)) {
        contentType = "image/webp";
      } else if (/\.gif$/.test(cleanUrl)) {
        contentType = "image/gif";
      } else if (/\.svg$/.test(cleanUrl)) {
        contentType = "image/svg+xml";
      } else {
        contentType = "application/octet-stream";
      }
    }

    logger.info({
      host: target.hostname,
      status: upstream.status,
      contentType,
      length: upstream.headers.get("content-length"),
      range: upstream.headers.get("content-range") || null,
    }, "[SPOTIFY-PROXY] Upstream");

    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    res.setHeader("Cache-Control", contentType.startsWith("image/") ? "public, max-age=3600" : "no-store");

    const length = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges");

    if (length) res.setHeader("Content-Length", length);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
    else if (contentType.startsWith("audio/")) res.setHeader("Accept-Ranges", "bytes");

    if (!upstream.body) {
      logger.error({ elapsedMs: Date.now() - startedAt }, "[SPOTIFY-PROXY] FAIL empty body");
      return res.end();
    }

    const { Readable } = await import("node:stream");
    logger.info({ elapsedMs: Date.now() - startedAt, status: upstream.status }, "[SPOTIFY-PROXY] STREAM START");
    return Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (error) {
    logger.error({ err: error, url: target.toString() }, "[SPOTIFY] Proxy gagal");
    if (!res.headersSent) {
      return res.status(502).type("text/plain").send(
        error instanceof Error ? error.message : "Proxy gagal",
      );
    }
    return res.end();
  } finally {
    clearTimeout(timer);
  }
});

app.use("/api/spotify", (req, _res, next) => {
  logger.info({
    method: req.method,
    url: req.originalUrl,
    host: req.headers.host,
    origin: req.headers.origin || null,
    referer: req.headers.referer || null,
    range: req.headers.range || null,
    userAgent: req.headers["user-agent"] || null,
  }, "[SPOTIFY-HTTP] REQUEST");
  next();
});

app.get("/api/spotify/audio/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const startedAt = Date.now();

  logger.info({
    id,
    range: String(req.headers.range || "") || null,
    userAgent: String(req.headers["user-agent"] || "") || null,
  }, "[SPOTIFY-AUDIO-PATH] START");

  if (!id) {
    logger.error("[SPOTIFY-AUDIO-PATH] FAIL missing id");
    return res.status(400).type("text/plain").send("id wajib diisi");
  }

  try {
    const { track, audioUrl } = await resolveSpotifyHtmlAudio(id);
    const range = String(req.headers.range || "");
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*",
      Referer: audioUrl.includes("y2mate") || audioUrl.includes("etacloud")
        ? "https://y2mate.gs/"
        : "https://spotsaver.net/",
    };

    if (range) headers.Range = range;

    logger.info({
      id,
      title: track.title,
      sourceHost: (() => { try { return new URL(audioUrl).host; } catch { return "INVALID_URL"; } })(),
      sourceLength: audioUrl.length,
      headers,
    }, "[SPOTIFY-AUDIO-PATH] FETCH");

    let upstream = await fetch(audioUrl, {
      headers,
      redirect: "follow",
    });

    logger.info({
      id,
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      length: upstream.headers.get("content-length"),
      contentRange: upstream.headers.get("content-range"),
      finalUrl: upstream.url,
    }, "[SPOTIFY-AUDIO-PATH] RESPONSE");

    if ([400, 401, 403].includes(upstream.status)) {
      logger.warn({ id, status: upstream.status }, "[SPOTIFY-AUDIO-PATH] RETRY");
      upstream = await fetch(audioUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "*/*",
          ...(range ? { Range: range } : {}),
        },
        redirect: "follow",
      });
      logger.info({
        id,
        status: upstream.status,
        contentType: upstream.headers.get("content-type"),
        length: upstream.headers.get("content-length"),
        contentRange: upstream.headers.get("content-range"),
        finalUrl: upstream.url,
      }, "[SPOTIFY-AUDIO-PATH] RETRY RESPONSE");
    }

    if (!upstream.ok && upstream.status !== 206) {
      const body = await upstream.text().catch(() => "");
      logger.error({
        id,
        status: upstream.status,
        body: body.slice(0, 500),
      }, "[SPOTIFY-AUDIO-PATH] FAIL UPSTREAM");
      return res.status(502).type("text/plain").send("Audio upstream HTTP " + upstream.status);
    }

    const upstreamType = (upstream.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const contentType =
      upstreamType &&
      upstreamType !== "application/octet-stream" &&
      upstreamType !== "binary/octet-stream" &&
      upstreamType !== "text/plain"
        ? upstreamType
        : "audio/mpeg";

    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");

    const length = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (length) res.setHeader("Content-Length", length);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    if (!upstream.body) {
      logger.error({ id }, "[SPOTIFY-AUDIO-PATH] FAIL empty body");
      return res.end();
    }

    const { Readable } = await import("node:stream");
    logger.info({
      id,
      status: upstream.status,
      contentType,
      elapsedMs: Date.now() - startedAt,
    }, "[SPOTIFY-AUDIO-PATH] STREAM");

    return Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (error) {
    logger.error({
      id,
      err: error,
      elapsedMs: Date.now() - startedAt,
    }, "[SPOTIFY-AUDIO-PATH] EXCEPTION");

    if (!res.headersSent) {
      return res.status(502).type("text/plain").send(
        error instanceof Error ? error.message : "Audio proxy gagal",
      );
    }
    return res.end();
  }
});

app.get("/api/spotify/cover/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();

  logger.info({ id }, "[SPOTIFY-COVER-PATH] START");

  try {
    const track = getSpotifyTrackById(id);
    if (!track.thumbnail) {
      logger.warn({ id }, "[SPOTIFY-COVER-PATH] NO THUMBNAIL");
      return res.status(404).end();
    }

    const target = new URL(track.thumbnail);
    logger.info({
      id,
      title: track.title,
      host: target.host,
      urlLength: track.thumbnail.length,
    }, "[SPOTIFY-COVER-PATH] FETCH");

    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: "https://open.spotify.com/",
      },
      redirect: "follow",
    });

    logger.info({
      id,
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      length: upstream.headers.get("content-length"),
      finalUrl: upstream.url,
    }, "[SPOTIFY-COVER-PATH] RESPONSE");

    if (!upstream.ok) {
      return res.status(502).type("text/plain").send("Cover upstream HTTP " + upstream.status);
    }

    res.status(200);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=3600");

    if (!upstream.body) return res.end();

    const { Readable } = await import("node:stream");
    logger.info({ id }, "[SPOTIFY-COVER-PATH] STREAM");
    return Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (error) {
    logger.error({ id, err: error }, "[SPOTIFY-COVER-PATH] EXCEPTION");
    if (!res.headersSent) return res.status(502).end();
    return res.end();
  }
});

app.get("/api/spotify/cover", async (req, res) => {
  try {
    const id = String(req.query.id || "").trim();
    const track = getSpotifyTrackById(id);
    if (!track.thumbnail) return res.status(404).end();

    return res.redirect(
      302,
      "/api/spotify/proxy?url=" +
        encodeURIComponent(track.thumbnail) +
        "&ref=" +
        encodeURIComponent("https://open.spotify.com/"),
    );
  } catch (error) {
    logger.error({ err: error }, "[SPOTIFY] Thumbnail gagal");
    return res.status(404).end();
  }
});

type Player = { id: string; name: string; ws: WebSocket; mark: "X"|"O"|"1"|"2" };
type Room = { game: string; players: Player[]; board: string[]; turn: string; winner: string };



// --- Spotify Live: pencarian dan audio sinkron ---
app.get("/api/spotify/stream", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!id) {
    return res.status(400).type("text/plain").send("id wajib diisi");
  }

  try {
    const { track, audioUrl } = await resolveSpotifyHtmlAudio(id);
    const range = String(req.headers.range || "");

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      Accept: "*/*",
      Referer: audioUrl.includes("y2mate") || audioUrl.includes("etacloud")
        ? "https://y2mate.gs/"
        : "https://spotsaver.net/",
    };

    if (range) headers.Range = range;

    logger.info({
      id,
      title: track.title,
      range: range || null,
    }, "[SPOTIFY] Stream request");

    let upstream = await fetch(audioUrl, {
      method: "GET",
      headers,
      redirect: "follow",
    });

    if ([400, 401, 403].includes(upstream.status)) {
      upstream = await fetch(audioUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "*/*",
          ...(range ? { Range: range } : {}),
        },
        redirect: "follow",
      });
    }

    const upstreamType = (upstream.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const contentType =
      upstreamType &&
      upstreamType !== "application/octet-stream" &&
      upstreamType !== "binary/octet-stream"
        ? upstreamType
        : /[?&]f=mp3(?:&|$)/i.test(audioUrl)
          ? "audio/mpeg"
          : "audio/mpeg";

    logger.info({
      id,
      title: track.title,
      status: upstream.status,
      contentType,
      length: upstream.headers.get("content-length"),
      contentRange: upstream.headers.get("content-range"),
    }, "[SPOTIFY] Stream upstream");

    if (!upstream.ok && upstream.status !== 206) {
      if (upstream.body) {
        try { await upstream.body.cancel(); } catch {}
      }
      return res.status(502).type("text/plain").send(
        "Audio upstream HTTP " + upstream.status,
      );
    }

    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges",
    );
    res.setHeader("Cache-Control", "no-store");

    const length = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (length) res.setHeader("Content-Length", length);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    if (!upstream.body) return res.end();

    const { Readable } = await import("node:stream");
    return Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (error) {
    logger.error({
      err: error,
      id,
    }, "[SPOTIFY] Stream gagal");

    return res.status(502).type("text/plain").send(
      error instanceof Error ? error.message : "Stream gagal",
    );
  }
});

app.get("/api/spotify-live/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results: [] });
  try {
    const result = await yts(q);
    res.json({ results: result.videos.slice(0, 10).map(v => ({
      videoId: v.videoId,
      title: v.title,
      artist: v.author?.name || "Unknown",
      thumbnail: v.thumbnail,
      duration: v.timestamp,
    })) });
  } catch (error) {
    logger.error({ err: error }, "[SPOTIFY-LIVE] Search gagal");
    res.status(500).json({ results: [] });
  }
});

app.get("/api/spotify-live/stream/:videoId", async (req, res) => {
  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${req.params.videoId}`);
    const format = ytdl.chooseFormat(info.formats, { filter: "audioonly", quality: "highestaudio" });
    const mime = format.mimeType?.split(";")[0] || "audio/webm";
    res.setHeader("Content-Type", mime);
    ytdl.downloadFromInfo(info, { format }).on("error", error => {
      logger.error({ err: error }, "[SPOTIFY-LIVE] Stream gagal");
      if (!res.headersSent) res.status(500);
      res.end();
    }).pipe(res);
  } catch (error) {
    logger.error({ err: error }, "[SPOTIFY-LIVE] Stream setup gagal");
    res.status(500).end();
  }
});

app.get("/api/spotify-live/room/:code", (req, res) => {
  const room = getSpotifyLiveRoom(String(req.params.code || ""));
  const playerId = String(req.query.playerId || "");
  const playerName = String(req.query.playerName || "");
  if (!room || !playerId) return res.status(404).json({ error: "ROOM_NOT_FOUND" });
  touchSpotifyLiveMember(room, playerId, playerName);
  return res.json(roomState(room, playerId));
});

app.post("/api/spotify-live/room/:code/join", (req, res) => {
  const room = getSpotifyLiveRoom(String(req.params.code || ""));
  const playerId = String(req.body?.playerId || "");
  const playerName = String(req.body?.name || "");
  if (!room || !playerId) return res.status(404).json({ error: "ROOM_NOT_FOUND" });
  const member = touchSpotifyLiveMember(room, playerId, playerName);
  const state = roomState(room, playerId);
  return res.json({
    ...state,
    isHost: room.ownerPlayerId === playerId || state.isHost,
    message:
      room.ownerPlayerId === playerId
        ? "Kamu adalah host."
        : "Berhasil masuk ke room.",
  });
});

app.post("/api/spotify-live/room/:code/event", (req, res) => {
  const room = getSpotifyLiveRoom(String(req.params.code || ""));
  const playerId = String(req.body?.playerId || "");
  const type = String(req.body?.type || "");
  if (!room || !playerId) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  touchSpotifyLiveMember(room, playerId, String(req.body?.name || ""));

  if (!spotifyLiveRoomIsHost(room, playerId) && type !== "room-chat") {
    return res.status(403).json({ error: "NOT_HOST" });
  }

  if (type === "play-track" && req.body?.track?.videoId) {
    setSpotifyLiveTrack(room, {
      videoId: String(req.body.track.videoId),
      title: String(req.body.track.title || ""),
      artist: String(req.body.track.artist || ""),
      thumbnail: String(req.body.track.thumbnail || ""),
      duration: String(req.body.track.duration || ""),
    });
  } else if (type === "toggle-play") {
    toggleSpotifyLive(room, Boolean(req.body.isPlaying), Number(req.body.position || 0));
  } else if (type === "sync-tick") {
    syncSpotifyLive(room, Number(req.body.position || 0));
  } else if (type === "room-chat") {
    addSpotifyLiveChat(room, playerId, String(req.body.text || ""));
  } else {
    return res.status(400).json({ error: "UNKNOWN_EVENT" });
  }

  return res.json(roomState(room, playerId));
});



const rooms = new Map<string, Room>();

function winTTT(b:string[], m:string) {
  return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(a=>a.every(i=>b[i]===m));
}
function winC4(b:string[], m:string) {
  for(let r=0;r<6;r++) for(let c=0;c<7;c++) if(b[r*7+c]===m) {
    for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      let n=1; for(let k=1;k<4;k++){const rr=r+dr*k,cc=c+dc*k;if(rr<0||rr>=6||cc<0||cc>=7||b[rr*7+cc]!==m)break;n++} if(n>=4)return true;
    }
  } return false;
}
function send(p:Player, data:unknown){if(p.ws.readyState===WebSocket.OPEN)p.ws.send(JSON.stringify(data))}
function broadcast(room:Room,message?:string){
  room.players.forEach(p=>send(p,{game:room.game,board:room.board,turn:room.turn,me:p.mark,message:message||room.winner||"Menunggu pemain..."}));
}
function reset(room:Room){room.board=Array(room.game==="tictactoe"?9:42).fill("");room.turn=room.players[0]?.mark||"1";room.winner=""}

wss.on("connection",(ws,req)=>{
  const u=new URL(req.url||"",`http://localhost`);
  const game=u.searchParams.get("game")||"";
  const roomId=u.searchParams.get("room")||"private";
  const playerId=u.searchParams.get("player")||Math.random().toString(36);
  const name=decodeURIComponent(u.searchParams.get("name")||"Pemain");
  if (game === "spotify") {
    ws.on("message", async raw => {
      let action: any;
      try { action = JSON.parse(raw.toString()); } catch { return; }

      const requestId = String(action?.requestId || "");
      if (!requestId) return;

      try {
        if (action.type === "spotifyResolve") {
          const id = String(action.id || "");
          const meta = await getSpotifyAudioMetaById(id);
          let coverDataUrl: string | null = null;
          try {
            coverDataUrl = await getSpotifyCoverDataById(id);
          } catch (error) {
            logger.warn({ id, err: error }, "[SPOTIFY] Cover rich HTML gagal");
          }

          ws.send(JSON.stringify({
            type: "spotifyActionResult",
            requestId,
            success: true,
            audioReady: true,
            audioSize: meta.size,
            audioTotal: meta.total,
            audioMime: meta.mime,
            coverDataUrl,
            title: meta.track.title,
            artist: meta.track.artist,
          }));
          return;
        }

        if (action.type === "spotifyChunk") {
          const id = String(action.id || "");
          const chunk = await getSpotifyAudioChunkById(id, Number(action.n));
          ws.send(JSON.stringify({
            type: "spotifyAudioChunk",
            requestId,
            success: true,
            id,
            n: chunk.n,
            total: chunk.total,
            mime: chunk.mime,
            data: chunk.data,
          }));
          return;
        }

        throw new Error("Aksi Spotify tidak dikenal.");
      } catch (error) {
        logger.error({ err: error }, "[SPOTIFY] HTML action gagal");
        ws.send(JSON.stringify({
          type: "spotifyActionResult",
          requestId,
          success: false,
          message: error instanceof Error ? error.message : "Aksi Spotify gagal",
        }));
      }
    });
    return;
  }

  if (game === "spotifylive") {
    const room = getSpotifyLiveRoom(roomId.toUpperCase());
    if (!room) { ws.close(1008, "Room Spotify Live tidak ditemukan"); return; }

    const member: SpotifyLiveMember = {
      id: playerId,
      name: name || "Pendengar",
      ws,
    };
    joinSpotifyLiveRoom(room, member);

    ws.on("message", raw => {
      try {
        const a = JSON.parse(raw.toString());
        if (a.type === "join") return;
        if (!spotifyLiveRoomIsHost(room, playerId)) {
          if (a.type === "room-chat") {
            const text = String(a.text || "").trim().slice(0, 300);
            if (text) {
              for (const m of room.members.values()) {
                sendSpotifyLive(m, { type: "room-chat", name: member.name, text });
              }
            }
          }
          return;
        }
        if (a.type === "play-track" && a.track?.videoId) {
          setSpotifyLiveTrack(room, {
            videoId: String(a.track.videoId),
            title: String(a.track.title || ""),
            artist: String(a.track.artist || ""),
            thumbnail: String(a.track.thumbnail || ""),
            duration: String(a.track.duration || ""),
          });
          return;
        }
        if (a.type === "toggle-play") {
          toggleSpotifyLive(room, Boolean(a.isPlaying), Number(a.position || 0));
          return;
        }
        if (a.type === "sync-tick") {
          syncSpotifyLive(room, Number(a.position || 0));
          return;
        }
        if (a.type === "seek") {
          toggleSpotifyLive(room, room.isPlaying, Number(a.position || 0));
        }
      } catch {}
    });
    ws.on("close", () => leaveSpotifyLiveRoom(room, playerId));
    return;
  }

  if(!["tictactoe","connect4"].includes(game)){ws.close(1008,"Game multiplayer tidak tersedia");return}
  const key=game+":"+roomId;
  let room=rooms.get(key);
  if(!room){room={game,players:[],board:Array(game==="tictactoe"?9:42).fill(""),turn:"",winner:""};rooms.set(key,room)}
  const old=room.players.find(p=>p.id===playerId);
  if(old){old.ws=ws;broadcast(room);return}
  if(room.players.length>=2){send({ws} as unknown as Player,{game,board:room.board,turn:room.turn,me:"",message:"Game ini sudah penuh (2 pemain)."});ws.close();return}
  const mark=game==="tictactoe"?(room.players.length===0?"X":"O"):(room.players.length===0?"1":"2");
  const player={id:playerId,name,ws,mark} as Player;
  room.players.push(player); if(room.players.length===1)room.turn=mark;
  broadcast(room,room.players.length<2?"Menunggu pemain kedua...":"Game dimulai! Giliran "+room.turn);

  ws.on("message",raw=>{
    try{
      const a=JSON.parse(raw.toString());
      if(a.type==="join")return;
      if(a.type==="new"){reset(room);broadcast(room,"Game direset. Giliran "+room.turn);return}
      if(room.players.length<2||room.winner||room.turn!==player.mark)return;
      if(game==="tictactoe"){
        const i=Number(a.index); if(!Number.isInteger(i)||i<0||i>8||room.board[i])return;
        room.board[i]=player.mark;
        if(winTTT(room.board,player.mark)){room.winner=player.name+" menang!";broadcast(room,room.winner);return}
        if(room.board.every(Boolean)){room.winner="Seri!";broadcast(room,room.winner);return}
      } else {
        const c=Number(a.col); if(!Number.isInteger(c)||c<0||c>6)return;
        let placed=-1; for(let r=5;r>=0;r--){const i=r*7+c;if(!room.board[i]){placed=i;break}}
        if(placed<0)return; room.board[placed]=player.mark;
        if(winC4(room.board,player.mark)){room.winner=player.name+" menang!";broadcast(room,room.winner);return}
        if(room.board.every(Boolean)){room.winner="Seri!";broadcast(room,room.winner);return}
      }
      room.turn=room.players.find(p=>p.mark!==player.mark)?.mark||player.mark;
      broadcast(room,"Giliran "+room.turn);
    }catch{}
  });
  ws.on("close",()=>{setTimeout(()=>{if(room?.players.every(p=>p.ws.readyState!==WebSocket.OPEN)){rooms.delete(key)}},30000)});
});

server.listen(port, "0.0.0.0", () => logger.info({ port, address: "0.0.0.0" }, "Server listening"));
