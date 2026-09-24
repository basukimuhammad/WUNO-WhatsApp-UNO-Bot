import { createBibzWhats, type BibzWhatsClient } from "@xbibzlibrary/whatsbibz";
import { env } from "../env";
import { updateBotStatus } from "../status";

let richClient: BibzWhatsClient | null = null;
let starting: Promise<BibzWhatsClient> | null = null;
let readyPromise: Promise<ReturnType<BibzWhatsClient["isConnected"]> extends boolean ? any : any> | null = null;

export async function startRichClient() {
  if (richClient?.isConnected() && richClient.sock) {
    return richClient.sock;
  }

  if (starting) {
    const client = await starting;
    return await waitForReady(client);
  }

  const phone = (env.PAIRING_PHONE_NUMBER ?? "").replace(/\D/g, "");
  if (!phone) {
    const message = "PAIRING_PHONE_NUMBER belum diatur untuk Rich HTML.";
    updateBotStatus("error", message, null, null);
    throw new Error(message);
  }

  starting = (async () => {
    const client = await createBibzWhats({
      phone,
      authDir: ".wuno-rich-auth",
      identity: "auto",
      fetchLatestVersion: true,
      readyOnEveryConnect: true,
      maxReconnectAttempts: 10,
      maxSessionWipes: 3,
      pairingRequestDelayMs: 5000,
      qrFallbackAfterMs: 0,
      banner: false,
    });

    richClient = client;

    client.on("pairing-code", (code: string) => {
      console.log("[WUNO-RICH] Kode pairing Rich HTML:", code);
      updateBotStatus(
        "pairing_code",
        "Masukkan kode " +
          code +
          " di WhatsApp utama: Perangkat tertaut > Tautkan perangkat > Tautkan dengan nomor telepon.",
        null,
        code,
      );
    });

    client.on("identity-changed", (info: { linkedDeviceName?: string; profileId?: string; reason?: string }) => {
      console.log(
        "[WUNO-RICH] Identitas perangkat:",
        info.linkedDeviceName ?? info.profileId ?? "unknown",
        info.reason ? "- " + info.reason : "",
      );
    });

    client.on("session-wiped", (reason: string) => {
      console.warn("[WUNO-RICH] Sesi Rich diperbarui:", reason);
    });

    client.on("give-up", (message: string) => {
      console.error("[WUNO-RICH] Pairing menyerah:", message);
      updateBotStatus("error", message, null, null);
    });

    client.on("close", (info: { status?: number }) => {
      console.warn("[WUNO-RICH] Rich HTML terputus:", info.status ?? "unknown");
    });

    return client;
  })();

  try {
    const client = await starting;
    return await waitForReady(client);
  } catch (error) {
    starting = null;
    throw error;
  }
}

async function waitForReady(client: BibzWhatsClient) {
  if (client.isConnected() && client.sock) {
    updateBotStatus("ready", "Transport Rich HTML WhatsApp sudah tersambung.", null, null);
    return client.sock;
  }

  if (!readyPromise) {
    readyPromise = new Promise((resolve, reject) => {
      const onReady = (sock: unknown) => {
        updateBotStatus("ready", "Transport Rich HTML WhatsApp sudah tersambung.", null, null);
        resolve(sock);
      };
      const onGiveUp = (message: string) => reject(new Error(message));

      client.once("ready", onReady);
      client.once("give-up", onGiveUp);
    }).finally(() => {
      readyPromise = null;
    });
  }

  return await readyPromise;
}

export function getRichSocket() {
  return richClient?.sock ?? null;
}
