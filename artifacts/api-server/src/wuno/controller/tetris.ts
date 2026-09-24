import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { TETRIS_HTML } from "../rich/games";

export default async function tetris(chat: Chat) {
  try { await sendRichHtml(chat, TETRIS_HTML, "🧱 WUNO Tetris", "tetris"); }
  catch (error) { chat.logger.error({ err: error }, "[RICH] Gagal membuka Tetris"); await chat.sendToCurrentPerson("🧱 Tetris belum bisa dibuka. Coba lagi sebentar."); }
}
