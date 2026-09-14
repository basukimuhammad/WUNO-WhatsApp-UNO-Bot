export type BotState =
  | "starting"
  | "qr"
  | "pairing_code"
  | "authenticated"
  | "ready"
  | "disconnected"
  | "auth_failure"
  | "error";

type BotStatus = {
  state: BotState;
  label: string;
  message: string;
  qrDataUrl: string | null;
  pairingCode: string | null;
  updatedAt: string;
};

const status: BotStatus = {
  state: "starting",
  label: "Menyiapkan bot",
  message: "Bot sedang menyiapkan database dan WhatsApp Web.",
  qrDataUrl: null,
  pairingCode: null,
  updatedAt: new Date().toISOString(),
};

const labels: Record<BotState, string> = {
  starting: "Menyiapkan bot",
  qr: "Menunggu scan QR",
  pairing_code: "Menunggu kode pairing",
  authenticated: "WhatsApp terautentikasi",
  ready: "Bot siap digunakan",
  disconnected: "WhatsApp terputus",
  auth_failure: "Autentikasi gagal",
  error: "Bot mengalami error",
};

export function updateBotStatus(
  state: BotState,
  message: string,
  qrDataUrl: string | null = status.qrDataUrl,
  pairingCode: string | null = status.pairingCode,
) {
  status.state = state;
  status.label = labels[state];
  status.message = message;
  status.qrDataUrl = qrDataUrl;
  status.pairingCode = pairingCode;
  status.updatedAt = new Date().toISOString();
}

export function getBotStatus(): Readonly<BotStatus> {
  return status;
}