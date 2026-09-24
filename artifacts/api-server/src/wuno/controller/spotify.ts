import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { SPOTIFY_HTML } from "../rich/games";

export default async function spotify(chat: Chat) {
  try { await sendRichHtml(chat, SPOTIFY_HTML, "🎵 WUNO Spotify", "spotify"); }
  catch (error) { chat.logger.error({ err: error }, "[RICH] Gagal membuka Spotify"); await chat.sendToCurrentPerson("🎵 Spotify belum bisa dibuka. Coba lagi sebentar."); }
}
