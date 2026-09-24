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

    if (!state.creds.registered) {
      const phone = normalizePhone(env.PAIRING_PHONE_NUMBER ?? "");
      if (!phone) throw new Error("PAIRING_PHONE_NUMBER belum diatur.");

      const code = await sock.requestPairingCode(phone);
      console.log("[WUNO-RICH] Kode pairing Rich HTML:", code);
      updateBotStatus(
        "pairing_code",
        "Kode pairing: " + code + ". Masukkan di WhatsApp utama: Perangkat tertaut > Tautkan perangkat > Tautkan dengan nomor telepon.",
        null,
        code,
      );
    }

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        socket = sock;
        console.log("[WUNO-RICH] Rich HTML WhatsApp tersambung.");
        updateBotStatus("ready", "Transport Rich HTML WhatsApp sudah tersambung.", null, null);
      }

      if (connection === "close") {
        socket = null;
        const statusCode = (
          lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
        )?.output?.statusCode;

        console.error(
          "[WUNO-RICH] Koneksi tertutup. statusCode=" + (statusCode ?? "unknown"),
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
