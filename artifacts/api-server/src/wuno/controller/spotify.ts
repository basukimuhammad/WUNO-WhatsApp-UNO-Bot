import type { Chat } from "../lib/Chat";
import { sendRichHtml } from "../rich/sendHtml";
import { buildSpotifyPlayerHtml } from "../rich/spotifyHtml";
import { createSpotifySession, resolveSpotifyHtmlAudio, spotifySearch } from "../spotify";

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

    const firstTrack = tracks[0]!;
    const resolved = await resolveSpotifyHtmlAudio(String(firstTrack.id));

    const html = buildSpotifyPlayerHtml(
      token,
      query,
      [
        {
          ...firstTrack,
          id: String(firstTrack.id),
          audioUrl: resolved.audioUrl,
        },
      ],
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
