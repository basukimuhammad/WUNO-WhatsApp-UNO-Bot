import { AIRich } from "@xbibzlibrary/whatsbibz";
import type { Chat } from "../lib/Chat";
import { startRichClient } from "./client";

function getPublicOrigin() {
  const explicit = process.env.PUBLIC_GAME_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const domain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (domain) return `https://${domain}`;

  return "";
}

export async function sendRichHtml(
  chat: Chat,
  html: string,
  title: string,
) {
  const sock = await startRichClient();
  const origin = getPublicOrigin();

  if (!origin) {
    throw new Error(
      "REPLIT_DEV_DOMAIN/PUBLIC_GAME_ORIGIN tidak tersedia untuk WebSocket game.",
    );
  }

  const wsUrl = origin.replace(/^http/i, origin.startsWith("https") ? "wss" : "ws") + "/ws/games";
  const preparedHtml = html.replaceAll("__WUNO_WS_URL__", wsUrl);

  const rich = new AIRich(sock)
    .setTitle(title)
    .addSection(
      AIRich.newLayout("Single", {
        __typename: "GenAIaeacdsnwHtmlPrimitive",
        payload: preparedHtml,
        trusted_sources: [origin],
        url: origin,
      }),
    );

  await rich.send(chat.message.from, {
    forwarded: true,
    notification: false,
    includesUnifiedResponse: true,
    includesSubmessages: false,
  });
}
