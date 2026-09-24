import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState } from "@yudzxml/baileys";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env";
import { updateBotStatus } from "../status";

let socket: ReturnType<typeof makeWASocket> | null = null;
let starting: Promise<ReturnType<typeof makeWASocket> | null> | null = null;

const here = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.resolve(here, "../../../.wuno-rich-auth");

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function startRichClient() {
  if (socket) return socket;
  if (starting) return starting;

  starting = (async () => {
    fs.mkdirSync(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.windows("Chrome"),
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on("creds.update", saveCreds);

    let pairingRequested = false;

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (
        connection === "connecting" &&
        !state.creds.registered &&
        !pairingRequested
      ) {
        pairingRequested = true;

        // Wait for the WebSocket handshake to settle before requesting
        // the pairing code. Calling requestPairingCode too early can return
        // 428 "Connection Closed".
        await new Promise((resolve) => setTimeout(resolve, 1500));

        try {
          const phone = normalizePhone(env.PAIRING_PHONE_NUMBER ?? "");

          if (!phone) {
            throw new Error("PAIRING_PHONE_NUMBER belum diatur.");
          }

          const code = await sock.requestPairingCode(phone);

          console.log("[WUNO-RICH] Kode pairing Rich HTML:", code);

          updateBotStatus(
            "pairing_code",
            "Kode pairing: " +
              code +
              ". Di WhatsApp utama: Perangkat tertaut > Tautkan perangkat > Tautkan dengan nomor telepon.",
            null,
            code,
          );
        } catch (error) {
          pairingRequested = false;
          console.error(
            "[WUNO-RICH] Gagal membuat kode pairing Rich HTML:",
            error,
          );
          updateBotStatus(
            "error",
            "Gagal membuat kode pairing Rich HTML. Restart lalu coba lagi.",
            null,
            null,
          );
        }
      }

      if (connection === "open") {
        socket = sock;
        console.log("[WUNO-RICH] Rich HTML WhatsApp tersambung.");

        updateBotStatus(
          "ready",
          "Transport Rich HTML WhatsApp sudah tersambung.",
          null,
          null,
        );
      }

      if (connection === "close") {
        socket = null;

        const statusCode = (
          lastDisconnect?.error as
            | { output?: { statusCode?: number } }
            | undefined
        )?.output?.statusCode;

        console.error(
          "[WUNO-RICH] Koneksi tertutup. statusCode=" +
            (statusCode ?? "unknown"),
          lastDisconnect?.error ?? "",
        );

        if (statusCode !== DisconnectReason.loggedOut) {
          starting = null;
          setTimeout(() => void startRichClient(), 5000);
        } else {
          starting = null;
          updateBotStatus(
            "disconnected",
            "Perangkat Rich HTML ter-logout. Jalankan ulang pairing code.",
            null,
            null,
          );
        }
      }
    });
    return sock;
  })();

  try {
    return await starting;
  } catch (error) {
    starting = null;
    throw error;
  }
}

export function getRichSocket() {
  return socket;
}
