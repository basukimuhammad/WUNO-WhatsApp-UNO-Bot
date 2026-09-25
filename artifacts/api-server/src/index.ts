import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import yts from "yt-search";
import ytdl from "ytdl-core";
import { roomState, getSpotifyLiveRoom, joinSpotifyLiveRoom, leaveSpotifyLiveRoom, spotifyLiveRoomIsHost, setSpotifyLiveTrack, toggleSpotifyLive, syncSpotifyLive, sendSpotifyLive, touchSpotifyLiveMember, addSpotifyLiveChat, type SpotifyLiveMember } from "./wuno/spotifyLive/runtime";
import app from "./app";
import { logger } from "./lib/logger";
import { getSpotifyAudio, getSpotifyTrack, resolveSpotifyTrack, sendSpotifyTrack, spotifySearch } from "./wuno/spotify";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/games" });

// --- Spotify biasa ---
app.get("/api/spotify/search", async (req,res)=>{
  try{
    const token=String(req.query.token||"");
    const q=String(req.query.q||"");
    const results=await spotifySearch(token,q);
    res.json({results});
  }catch(e){
    logger.error({err:e,q:String(req.query.q||"")},"[SPOTIFY] Search endpoint gagal");
    res.status(400).json({error:e instanceof Error?e.message:"Search gagal"});
  }
});
app.get("/api/spotify/resolve", async (req,res)=>{try{const track=await resolveSpotifyTrack(String(req.query.token||""),Number(req.query.index));res.json({track:{...track,audioUrl:null}})}catch(e){res.status(400).json({error:e instanceof Error?e.message:"Resolve gagal"})}});
app.get("/api/spotify/cover", async (req,res)=>{try{const track=getSpotifyTrack(String(req.query.token||""),Number(req.query.index));if(!track.thumbnail)return res.status(404).end();const r=await fetch(track.thumbnail,{headers:{"User-Agent":"Mozilla/5.0","Accept":"image/*"}});if(!r.ok)return res.status(404).end();res.setHeader("Content-Type",r.headers.get("content-type")||"image/jpeg");res.setHeader("Cache-Control","public,max-age=300");res.send(Buffer.from(await r.arrayBuffer()))}catch{res.status(404).end()}});
app.get("/api/spotify/stream", async (req,res)=>{try{const {track,buffer,mime}=await getSpotifyAudio(String(req.query.token||""),Number(req.query.index));res.setHeader("Content-Type",mime||"audio/mpeg");res.setHeader("Content-Length",String(buffer.length));res.setHeader("Cache-Control","no-store");res.send(buffer)}catch{res.status(400).end()}});
app.get("/api/spotify/download", async (req,res)=>{try{const {track,buffer,mime}=await getSpotifyAudio(String(req.query.token||""),Number(req.query.index));const name=track.title.replace(/[<>:"/\\|?*\\x00-\\x1F]/g," ").slice(0,120)+".m4a";res.setHeader("Content-Type",mime||"audio/mp4");res.setHeader("Content-Disposition",'attachment; filename="'+name.replace(/"/g,"")+'"');res.setHeader("Content-Length",String(buffer.length));res.send(buffer)}catch(e){res.status(400).type("text/plain").send(e instanceof Error?e.message:"Gagal mengunduh audio")}});
app.post("/api/spotify/send", async (req,res)=>{try{const result=await sendSpotifyTrack(String(req.query.token||""),Number(req.query.index));res.json({success:true,...result})}catch(e){res.status(400).json({error:e instanceof Error?e.message:"Gagal mengirim audio"})}});
app.get("/api/spotify/send", async (req,res)=>{try{const result=await sendSpotifyTrack(String(req.query.token||""),Number(req.query.index));res.type("text/plain").send("Audio berhasil dikirim ke WhatsApp: "+result.title)}catch(e){res.status(400).type("text/plain").send(e instanceof Error?e.message:"Gagal mengirim audio")}});


type Player = { id: string; name: string; ws: WebSocket; mark: "X"|"O"|"1"|"2" };
type Room = { game: string; players: Player[]; board: string[]; turn: string; winner: string };



// --- Spotify Live: pencarian dan audio sinkron ---
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
      let action:any;
      try { action = JSON.parse(raw.toString()); } catch { return; }
      const requestId = String(action?.requestId || "");
      if (!requestId) return;

      try {
        if (action.type === "spotifyResolve") {
          const token = String(action.token || "");
          const indexValue = Number(action.index);
          if (!Number.isInteger(indexValue) || indexValue < 0) {
            throw new Error("Index lagu tidak valid.");
          }
          const track = await resolveSpotifyTrack(token, indexValue);
          ws.send(JSON.stringify({
            type: "spotifyActionResult",
            requestId,
            success: true,
            audioUrl:
              "/api/spotify/stream?token=" +
              encodeURIComponent(token) +
              "&index=" +
              encodeURIComponent(String(indexValue)),
            cover: track.thumbnail || null,
          }));
          return;
        }

        if (action.type === "spotifyDownload") {
          const token = String(action.token || "");
          const indexValue = Number(action.index);
          if (!Number.isInteger(indexValue) || indexValue < 0) {
            throw new Error("Index lagu tidak valid.");
          }
          const result = await sendSpotifyTrack(token, indexValue);
          ws.send(JSON.stringify({
            type: "spotifyActionResult",
            requestId,
            success: true,
            message: "Audio sudah dikirim ke WhatsApp.",
            title: result.title,
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

server.listen(port,()=>logger.info({port},"Server listening"));
