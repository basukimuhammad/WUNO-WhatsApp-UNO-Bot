import type { Chat } from "../lib/Chat";
import { getRichSocket } from "../rich/client";
import { sendHtmlApp } from "@yudzxml/baileys";
import { WUNO_GAME_HTML } from "../rich/gameHtml";

export default async function tetris(chat: Chat) {
  const sock = getRichSocket();
  if (!sock) {
    await chat.sendToCurrentPerson("🎮 WUNO Game Center sedang menyiapkan perangkat Rich HTML. Coba lagi beberapa detik lagi.");
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
}
