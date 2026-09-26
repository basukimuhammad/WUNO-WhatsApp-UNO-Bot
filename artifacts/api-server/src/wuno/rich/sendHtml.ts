import { AIRich } from "@xbibzlibrary/whatsbibz";
import type { Chat } from "../lib/Chat";
import { startRichClient } from "./client";

function getPublicOrigin() {
  const explicit = process.env.PUBLIC_GAME_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const domains = process.env.REPLIT_DOMAINS?.trim();
  if (domains) {
    const domain = domains
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);
    if (domain) {
      return domain.startsWith("http")
        ? domain.replace(/\/$/, "")
        : `https://${domain}`;
    }
  }

  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (devDomain) return `https://${devDomain}`;

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
      "PUBLIC_GAME_ORIGIN/REPLIT_DOMAINS/REPLIT_DEV_DOMAIN tidak tersedia.",
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
    game === "spotify"
      ? wsUrl + "?game=spotify&room=" + room + "&player=" + player + "&name=" + name
      : wsUrl + "?game=" + encodeURIComponent(game) + "&roomId=" + room + "&playerId=" + player + "&playerName=" + name;
  console.info("[RICH-HTML] PUBLIC ORIGIN", {
    origin,
    replitDevDomain: process.env.REPLIT_DEV_DOMAIN || null,
    replitDomains: process.env.REPLIT_DOMAINS || null,
    publicGameOrigin: process.env.PUBLIC_GAME_ORIGIN || null,
    game,
  });

  const preparedHtml = html
    .replaceAll("__WUNO_WS_URL__", JSON.stringify(gameUrl))
    .replaceAll("__WUNO_API_ORIGIN__", origin)
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

  console.info("[RICH-HTML] PREPARED", {
    game,
    title,
    origin,
    wsUrl,
    htmlLength: preparedHtml.length,
    hasApiOrigin: preparedHtml.includes(origin),
    hasSpotifyProxy: preparedHtml.includes("/api/spotify/proxy"),
    hasAudioTag: preparedHtml.includes("<audio"),
    hasAudioUrl: preparedHtml.includes("cdn-preview.dzcdn.net"),
  });

  const trustedHost = (() => {
    try {
      return new URL(origin).host;
    } catch {
      return origin.replace(/^https?:\/\//i, "").split("/")[0];
    }
  })();

  console.info("[RICH-HTML] TRUSTED SOURCE", {
    origin,
    trustedHost,
  });

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

  console.info("[RICH-HTML] SENDING", {
    to: chat.message.from,
    title,
    game,
  });

  await rich.send(chat.message.from, {
    forwarded: true,
    notification: false,
    includesUnifiedResponse: true,
    includesSubmessages: false,
  });

  console.info("[RICH-HTML] SEND COMPLETE", {
    to: chat.message.from,
    title,
    game,
  });
}
