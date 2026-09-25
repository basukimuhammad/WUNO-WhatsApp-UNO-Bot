import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { SPOTIFY_LIVE_HTML } from "../rich/games";
import { createOrGetSpotifyLiveRoom } from "../spotifyLive/runtime";

export default async function spotifyLive(chat: Chat) {
  try {
    const room = createOrGetSpotifyLiveRoom(chat.message.from);
    await sendRichHtml(chat, SPOTIFY_LIVE_HTML, "🎧 WUNO Spotify Live", "spotifylive", room.code);
    await chat.sendToCurrentPerson(`🎧 *Spotify Live siap!*

🔑 Kode room: *${room.code}*

Buka kartu di atas. Host bisa memilih lagu dan semua pemain di room yang sama akan mendengarkan bersama secara sinkron.`);
  } catch (error) {
    chat.logger.error({ err: error }, "[RICH] Gagal membuka Spotify Live");
    await chat.sendToCurrentPerson("🎧 Spotify Live belum bisa dibuka. Coba lagi sebentar.");
  }
}
