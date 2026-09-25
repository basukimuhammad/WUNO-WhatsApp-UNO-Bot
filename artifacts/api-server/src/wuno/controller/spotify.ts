import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { SPOTIFY_PLAYER_HTML } from "../rich/spotifyHtml";
import { createSpotifySession, spotifySearch } from "../spotify";

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

    const html = SPOTIFY_PLAYER_HTML
      .replaceAll("__WUNO_SPOTIFY_TOKEN__", JSON.stringify(token))
      .replaceAll("__WUNO_SPOTIFY_QUERY__", JSON.stringify(query))
      .replaceAll(
        "__WUNO_SPOTIFY_TRACKS__",
        JSON.stringify(tracks.slice(0, 8)).replace(/</g, "\\u003c"),
      );

    await sendRichHtml(chat, html, "🎵 WUNO Spotify", "spotify");
  } catch (error) {
    chat.logger.error({ err: error }, "[SPOTIFY] Gagal membuat player");
    await chat.sendToCurrentPerson(
      "🎵 Spotify gagal: " +
        (error instanceof Error ? error.message : "unknown error"),
    );
  }
}
