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
      browser: Browsers.windows("Chrome"),
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on("creds.update", saveCreds);

    // Register listeners before requesting the pairing code so we don't miss
    // the connection lifecycle events.
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

    // The fork documents requestPairingCode after makeWASocket(); wait a little
    // for the initial WebSocket handshake to avoid a transient 428.
    if (!state.creds.registered) {
      const phone = normalizePhone(env.PAIRING_PHONE_NUMBER ?? "");

      if (!phone) {
        updateBotStatus(
          "error",
          "PAIRING_PHONE_NUMBER belum diatur untuk Rich HTML.",
          null,
          null,
        );
        throw new Error("PAIRING_PHONE_NUMBER belum diatur.");
      }

      try {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const code = await sock.requestPairingCode(phone);

        console.log("[WUNO-RICH] Kode pairing Rich HTML:", code);

        updateBotStatus(
          "pairing_code",
          "Masukkan kode " +
            code +
            " di WhatsApp utama melalui Perangkat tertaut > Tautkan perangkat > Tautkan dengan nomor telepon.",
          null,
          code,
        );
      } catch (error) {
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
        throw error;
      }
    }

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
