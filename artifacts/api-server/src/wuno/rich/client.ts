import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
} from "@yudzxml/baileys";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import QRCode from "qrcode";

import { env } from "../env";
import { updateBotStatus } from "../status";

let socket: ReturnType<typeof makeWASocket> | null = null;
let starting: Promise<ReturnType<typeof makeWASocket> | null> | null = null;

const here = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.resolve(here, "../../../.wuno-rich-auth");

function cleanPhone(value: string) {
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
      browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on("creds.update", saveCreds);

    let pairingRequested = false;

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
          updateBotStatus(
            "qr",
            "QR Rich HTML tersedia. Tautkan perangkat dari WhatsApp > Perangkat tertaut > Tautkan perangkat.",
            dataUrl,
            null,
          );
        } catch (error) {
          console.error("[WUNO-RICH] Gagal membuat QR:", error);
        }
      }

      if (connection === "connecting" && !state.creds.registered && !pairingRequested) {
        pairingRequested = true;
        setTimeout(async () => {
          try {
            const phone = cleanPhone(env.PAIRING_PHONE_NUMBER ?? "");
            if (!phone || state.creds.registered) return;
            const code = await sock.requestPairingCode(phone);
            console.log("[WUNO-RICH] Kode pairing Rich HTML:", code);
            updateBotStatus(
              "pairing_code",
              "Masukkan kode ini di WhatsApp > Perangkat tertaut > Tautkan dengan nomor telepon.",
              null,
              code,
            );
          } catch (error) {
            console.error("[WUNO-RICH] Gagal membuat kode pairing:", error);
            pairingRequested = false;
          }
        }, 1500);
      }

      if (connection === "open") {
        socket = sock;
        console.log("[WUNO-RICH] Rich HTML WhatsApp tersambung.");
      }

      if (connection === "close") {
        socket = null;
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        console.error(`[WUNO-RICH] Koneksi tertutup. statusCode=${statusCode ?? "unknown"}`, lastDisconnect?.error ?? "");
        if (statusCode !== DisconnectReason.loggedOut) {
          starting = null;
          setTimeout(() => void startRichClient(), 3000);
        } else {
          starting = null;
          console.error("[WUNO-RICH] Perangkat Rich HTML ter-logout. Hapus .wuno-rich-auth lalu tautkan ulang.");
        }
      }
    });

    return sock;
  })();

  try {
    return await starting;
  } finally {
    if (!socket) starting = null;
  }
}

export function getRichSocket() {
  return socket;
}
