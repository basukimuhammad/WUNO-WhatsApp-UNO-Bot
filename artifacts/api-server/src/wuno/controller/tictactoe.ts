import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { TTT_HTML } from "../rich/games";

export default async function tictactoe(chat: Chat) {
  try { await sendRichHtml(chat, TTT_HTML, "⭕ WUNO Tic-Tac-Toe", "tictactoe"); }
  catch (error) { chat.logger.error({ err: error }, "[RICH] Gagal membuka Tic-Tac-Toe"); await chat.sendToCurrentPerson("⭕ Tic-Tac-Toe belum bisa dibuka. Coba lagi sebentar."); }
}
