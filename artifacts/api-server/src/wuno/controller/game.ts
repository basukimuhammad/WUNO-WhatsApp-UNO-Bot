import type { Chat } from "../lib/Chat";

const getGameCenterUrl = () => {
  const explicitUrl = process.env.PUBLIC_GAME_CENTER_URL?.trim();
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");

  const replitDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDomain) return `https://${replitDomain}/wuno/game`;

  return null;
};

export default async function gameCenter(chat: Chat) {
  const url = getGameCenterUrl();

  if (!url) {
    await chat.sendToCurrentPerson(
      "🎮 WUNO Game Center belum punya URL publik. Atur environment variable PUBLIC_GAME_CENTER_URL ke URL Replit kamu lalu coba lagi.",
    );
    return;
  }

  await chat.sendToCurrentPerson(
    `🎮 *WUNO GAME CENTER*

Buka:
${url}

Di sana tersedia mini-game dan fitur music yang sudah disiapkan WUNO.`,
  );
}
