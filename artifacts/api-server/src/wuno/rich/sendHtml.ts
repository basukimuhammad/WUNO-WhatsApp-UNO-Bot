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
  game = "solo",
  roomIdOverride?: string,
  hostOverride = false,
) {
  const sock = await startRichClient();
  const origin = getPublicOrigin();

  if (!origin) {
    throw new Error(
      "REPLIT_DEV_DOMAIN/PUBLIC_GAME_ORIGIN tidak tersedia untuk WebSocket game.",
    );
  }

  const wsUrl =
    origin.replace(/^http/i, origin.startsWith("https") ? "wss" : "ws") +
    "/ws/games";
  const room = encodeURIComponent(roomIdOverride || chat.message.from);
  const player = encodeURIComponent(chat.message.userNumber);
  const name = encodeURIComponent(
    chat.message.userName || chat.message.userNumber,
  );
  // The reference Spotify Live HTML reads roomId/playerId/playerName.
  const gameUrl =
    `${wsUrl}?game=${encodeURIComponent(game)}&roomId=${room}&playerId=${player}&playerName=${name}`;
  const preparedHtml = html
    .replaceAll("__WUNO_WS_URL__", JSON.stringify(gameUrl))
    .replaceAll("__WUNO_API_ORIGIN__", JSON.stringify(origin))
    .replaceAll(
      "__WUNO_ROOM_ID__",
      JSON.stringify(roomIdOverride || chat.message.from),
    )
    .replaceAll(
      "__WUNO_PLAYER_ID__",
      JSON.stringify(String(chat.message.userNumber || "")),
    )
    .replaceAll("__WUNO_IS_HOST__", JSON.stringify(Boolean(hostOverride)))
    .replaceAll(
      "__WUNO_PLAYER_NAME__",
      JSON.stringify(
        String(chat.message.userName || chat.message.userNumber || "Pendengar"),
      ),
    );

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
