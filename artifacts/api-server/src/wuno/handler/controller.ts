import ban from "../controller/ban";
import unban from "../controller/unban";
import cards from "../controller/cards";
import creategame from "../controller/creategame";
import draw from "../controller/draw";
import endgame from "../controller/endgame";
import infogame from "../controller/infogame";
import game from "../controller/gameMenu";
import tetris from "../controller/tetris";
import tictactoe from "../controller/tictactoe";
import connect4 from "../controller/connect4";
import spotify from "../controller/spotify";
import spotifyLive from "../controller/spotifyLive";
import joingame from "../controller/joingame";
import kick from "../controller/kick";
import leaderboard from "../controller/leaderboard";
import leavegame from "../controller/leavegame";
import play from "../controller/play";
import say from "../controller/say";
import startgame from "../controller/startgame";
import uno from "../controller/uno";

const controllers = {
  ban,
  unban,
  cards,
  creategame,
  draw,
  endgame,
  infogame,
  game,
  tetris,
  tictactoe,
  connect4,
  spotify,
  spotifylive: spotifyLive,
  joingame,
  kick,
  leaderboard,
  leavegame,
  play,
  say,
  sayto: say,
  startgame,
  uno,
};

/**
 * Lists of all controller name
 */
export const controllerName = Object.keys(controllers);

/**
 * Function that call all of the controller from controller directory
 * @returns List of all controllers object
 */
export async function getController() {
  return controllers;
}
