import type { Chat } from "../lib/Chat";

export default async function gameMenu(chat: Chat) {
  await chat.sendToCurrentPerson(
    `🎮 *WUNO GAME*

Game HTML sekarang dipisah per perintah:

🧱 U#tetris — Tetris
⭕ U#tictactoe — Tic-Tac-Toe 2 pemain
🔴 U#connect4 — Connect Four 2 pemain
🐍 U#snake — Snake
🦖 U#dino — Dino Runner
🎵 U#spotify — Spotify

👥 Game multiplayer bisa dimainkan bersama di grup yang sama.
Ketik perintah game yang kamu mau, bukan U#game lagi untuk membuka semuanya sekaligus.`,
  );
}
