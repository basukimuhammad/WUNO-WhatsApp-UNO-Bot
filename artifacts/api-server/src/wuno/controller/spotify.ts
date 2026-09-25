import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { buildSpotifyPlayerHtml } from "../rich/spotifyHtml";
import { createSpotifySession, resolveSpotifyTrack, spotifySearch } from "../spotify";

export default async function spotify(chat: Chat) {
  try {
    const query = chat.args.join(" ").trim();

    if (!query) {
      await chat.sendToCurrentPerson(
        "🎵 Gunakan: U#spotify <judul lagu atau artis>",
      );
      return;
    }

    await chat.sendToCurrentPerson("🔎 Mencari lagu...");

    const token = createSpotifySession(chat.client, chat.message.from);
    const tracks = await spotifySearch(token, query);

    if (!tracks.length) {
      await chat.sendToCurrentPerson(
        "🎵 Lagu tidak ditemukan dari SpotSaver.",
      );
      return;
    }

    // Siapkan track pertama sebelum kartu dikirim. Jadi audio player tidak perlu
    // menjalankan proses YouTube/Y2Mate saat tombol Play ditekan.
    await resolveSpotifyTrack(token, 0);

    const html = buildSpotifyPlayerHtml(token, query, tracks.slice(0, 8));
    await sendRichHtml(chat, html, "🎵 WUNO Spotify", "spotify");
  } catch (error) {
    chat.logger.error({ err: error }, "[SPOTIFY] Gagal membuat player");
    await chat.sendToCurrentPerson(
      "🎵 Spotify gagal: " +
        (error instanceof Error ? error.message : "unknown error"),
    );
  }
}
