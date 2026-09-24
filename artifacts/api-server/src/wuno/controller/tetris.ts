import type { Chat } from "../lib/Chat";
import { getRichSocket, startRichClient } from "../rich/client";
import { sendHtmlApp } from "@yudzxml/baileys";
import { WUNO_GAME_HTML } from "../rich/gameHtml";

export default async function tetris(chat: Chat) {
  try {
    const sock = await startRichClient();

    if (!sock) {
      await chat.sendToCurrentPerson(
        "🎮 WUNO Game Center belum tersambung. Coba lagi beberapa detik.",
      );
      return;
    }

    await sendHtmlApp(sock, chat.message.from, WUNO_GAME_HTML, {
      title: "🎮 WUNO Game Center",
      label: "Buka Game Center",
      embedded: true,
      screenTitle: "WUNO Game Center",
      tabHeader: "Games",
      guard: "warn",
    });
  } catch (error) {
    chat.logger.error({ err: error }, "[RICH] Gagal membuka Game Center");
    await chat.sendToCurrentPerson(
      "🎮 Game Center belum bisa dibuka. Pastikan perangkat Rich HTML sudah selesai pairing, lalu coba lagi.",
    );
  }
}
