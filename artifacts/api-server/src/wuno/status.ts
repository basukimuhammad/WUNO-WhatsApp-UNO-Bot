export type BotState =
  | "starting"
  | "qr"
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
  updatedAt: string;
};

const status: BotStatus = {
  state: "starting",
  label: "Menyiapkan bot",
  message: "Bot sedang menyiapkan database dan WhatsApp Web.",
  qrDataUrl: null,
  updatedAt: new Date().toISOString(),
};

const labels: Record<BotState, string> = {
  starting: "Menyiapkan bot",
  qr: "Menunggu scan QR",
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
) {
  status.state = state;
  status.label = labels[state];
  status.message = message;
  status.qrDataUrl = qrDataUrl;
  status.updatedAt = new Date().toISOString();
}

export function getBotStatus(): Readonly<BotStatus> {
  return status;
}