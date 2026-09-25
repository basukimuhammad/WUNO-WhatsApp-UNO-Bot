import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { SPOTIFY_LIVE_HTML } from "../rich/games";
import {
  createOrGetSpotifyLiveRoom,
  getSpotifyLiveRoom,
} from "../spotifyLive/runtime";

export default async function spotifyLive(chat: Chat) {
  try {
    const requestedCode = chat.args[0]?.trim().toUpperCase();
    const room = requestedCode
      ? getSpotifyLiveRoom(requestedCode)
      : createOrGetSpotifyLiveRoom(chat.message.from, chat.message.userNumber);

    if (!room) {
      await chat.sendToCurrentPerson(
        "🎧 Kode room Spotify Live tidak ditemukan atau room sudah ditutup.",
      );
      return;
    }

    await sendRichHtml(
      chat,
      SPOTIFY_LIVE_HTML,
      "🎧 WUNO Spotify Live",
      "spotifylive",
      room.code,
    );

    await chat.sendToCurrentPerson(
      requestedCode
        ? `🎧 Berhasil masuk ke Spotify Live.

🔑 Room: *${room.code}*
👥 Buka kartu di atas untuk bergabung sebagai pendengar.`
        : `🎧 *Spotify Live siap!*

🔑 Kode room: *${room.code}*

👑 Kamu adalah pembuat room.
📣 Bagikan kode ini ke teman:
*U#spotifylive ${room.code}*

Buka kartu di atas. Host bisa memilih lagu dan semua pemain di room yang sama akan mendengarkan bersama secara sinkron.`,
    );
  } catch (error) {
    chat.logger.error({ err: error }, "[RICH] Gagal membuka Spotify Live");
    await chat.sendToCurrentPerson(
      "🎧 Spotify Live belum bisa dibuka. Coba lagi sebentar.",
    );
  }
}
