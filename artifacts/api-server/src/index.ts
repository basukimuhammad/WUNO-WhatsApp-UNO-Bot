import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/games" });

type Player = { id: string; name: string; ws: WebSocket; mark: "X"|"O"|"1"|"2" };
type Room = { game: string; players: Player[]; board: string[]; turn: string; winner: string };

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
