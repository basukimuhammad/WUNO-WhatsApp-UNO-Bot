import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { CONNECT4_HTML } from "../rich/games";

export default async function connect4(chat: Chat) {
  try { await sendRichHtml(chat, CONNECT4_HTML, "🔴 WUNO Connect Four", "connect4"); }
  catch (error) { chat.logger.error({ err: error }, "[RICH] Gagal membuka Connect Four"); await chat.sendToCurrentPerson("🔴 Connect Four belum bisa dibuka. Coba lagi sebentar."); }
}
