import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { SPOTIFY_LIVE_HTML } from "../rich/games";
import { createOrGetSpotifyLiveRoom } from "../spotifyLive/runtime";

function getOrigin() {
  const explicit = process.env.PUBLIC_GAME_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const domain = process.env.REPLIT_DEV_DOMAIN?.trim();
  return domain ? `https://${domain}` : "";
}

export default async function spotifyLive(chat: Chat) {
  try {
    const room = createOrGetSpotifyLiveRoom(chat.message.from);
    const origin = getOrigin();
    if (!origin) throw new Error("PUBLIC_GAME_ORIGIN/REPLIT_DEV_DOMAIN tidak tersedia.");
    const url = `${origin}/wuno/spotify-live?code=${encodeURIComponent(room.code)}`;
    await sendRichHtml(chat, SPOTIFY_LIVE_HTML, "🎧 WUNO Spotify Live", "spotifylive", room.code);
    await chat.sendToCurrentPerson(`🎧 *Spotify Live siap!*

🔑 Kode room: *${room.code}*
🔗 ${url}

Buka kartu di atas. Orang yang masuk ke room yang sama bisa mendengarkan lagu bareng secara sinkron.`);
  } catch (error) {
    chat.logger.error({ err: error }, "[RICH] Gagal membuka Spotify Live");
    await chat.sendToCurrentPerson("🎧 Spotify Live belum bisa dibuka. Coba lagi sebentar.");
  }
}
