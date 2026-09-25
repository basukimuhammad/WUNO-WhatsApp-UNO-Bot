import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { SPOTIFY_HTML } from "../rich/games";
import { createSpotifySession } from "../spotify";

export default async function spotify(chat: Chat) {
  try {
    const token = createSpotifySession(chat.client, chat.message.from);
    const initialQuery = chat.args.join(" ").trim();
    const html = SPOTIFY_HTML
      .replaceAll("__WUNO_SPOTIFY_TOKEN__", JSON.stringify(token))
      .replaceAll("__WUNO_SPOTIFY_INITIAL_QUERY__", JSON.stringify(initialQuery));
    await sendRichHtml(chat, html, "🎵 WUNO Spotify", "spotify");
  } catch (error) {
    chat.logger.error({ err: error }, "[RICH] Gagal membuka Spotify");
    await chat.sendToCurrentPerson("🎵 Spotify belum bisa dibuka. Coba lagi sebentar.");
  }
}
