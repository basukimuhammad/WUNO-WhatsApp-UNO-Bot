import { AIRich } from "@xbibzlibrary/whatsbibz";
import type { Chat } from "../lib/Chat";
import { startRichClient } from "../rich/client";
import { WUNO_GAME_HTML } from "../rich/gameHtml";

export default async function tetris(chat: Chat) {
  try {
    const sock = await startRichClient();

    const rich = new AIRich(sock)
      .setTitle("🎮 WUNO Game Center")
      .addSection({
        view_model: {
          primitive: {
            __typename: "GenAIaeacdsnwHtmlPrimitive",
            payload: WUNO_GAME_HTML,
            trusted_sources: [],
          },
          __typename: "GenAISingleLayoutViewModel",
        },
      });

    await rich.send(chat.message.from, {
      forwarded: true,
      notification: false,
      includesUnifiedResponse: true,
      includesSubmessages: false,
    });
  } catch (error) {
    chat.logger.error({ err: error }, "[RICH] Gagal membuka Game Center");
    await chat.sendToCurrentPerson(
      "🎮 Game Center belum bisa dibuka. Perangkat Rich HTML belum tersambung atau pairing belum selesai.",
    );
  }
}
