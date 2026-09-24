import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
} from "@yudzxml/baileys";
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
      printQRInTerminal: false,
      browser: Browsers.ubuntu("WUNO Rich"),
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on("creds.update", saveCreds);

    if (!state.creds.registered) {
      const phone = normalizePhone(env.PAIRING_PHONE_NUMBER ?? "");

      if (!phone) {
        updateBotStatus(
          "error",
          "PAIRING_PHONE_NUMBER belum diatur untuk perangkat Rich HTML.",
          null,
          null,
        );
        throw new Error("PAIRING_PHONE_NUMBER belum diatur.");
      }

      // The Yudzxml Baileys fork documents pairing-code authentication
      // immediately after makeWASocket() when credentials are not registered.
      try {
        const code = await sock.requestPairingCode(phone);
        console.log("[WUNO-RICH] Kode pairing Rich HTML:", code);
        updateBotStatus(
          "pairing_code",
          "Masukkan kode ini di WhatsApp utama: Perangkat tertaut > Tautkan perangkat > Tautkan dengan nomor telepon.",
          null,
          code,
        );
      } catch (error) {
        updateBotStatus(
          "error",
          "Gagal membuat kode pairing Rich HTML. Periksa log dan coba restart.",
          null,
          null,
        );
        throw error;
      }
    }

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
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
          `[WUNO-RICH] Koneksi tertutup. statusCode=${statusCode ?? "unknown"}`,
          lastDisconnect?.error ?? "",
        );

        if (statusCode !== DisconnectReason.loggedOut) {
          starting = null;
          setTimeout(() => void startRichClient(), 3000);
        } else {
          starting = null;
          console.error(
            "[WUNO-RICH] Perangkat Rich HTML ter-logout. Hapus .wuno-rich-auth lalu tautkan ulang.",
          );
        }
      }
    });

    return sock;
  })();

  try {
    return await starting;
  } finally {
    if (!socket && starting) {
      starting = null;
    }
  }
}

export function getRichSocket() {
  return socket;
}
