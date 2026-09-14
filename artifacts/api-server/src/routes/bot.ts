import { Router, type IRouter } from "express";
import { getBotStatus } from "../wuno/status";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="8" />
    <title>WUNO WhatsApp Bot</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111318; color: #f3f4f6; }
      main { width: min(92vw, 560px); box-sizing: border-box; padding: 32px; border: 1px solid #30343d; border-radius: 20px; background: #191c23; text-align: center; box-shadow: 0 22px 60px #0006; }
      h1 { margin: 0 0 8px; font-size: 1.65rem; }
      p { color: #aeb4c0; line-height: 1.55; }
      .status { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: #272c36; color: #dce3ef; font-weight: 650; }
      .dot { width: 9px; height: 9px; border-radius: 50%; background: #f0a93a; }
      .ready .dot { background: #4bd28a; }
      img { display: block; width: min(100%, 320px); margin: 22px auto 16px; border-radius: 12px; background: white; padding: 12px; box-sizing: border-box; }
      .hint { font-size: .92rem; }
      code { color: #f5c86c; }
    </style>
  </head>
  <body>
    <main class="${getBotStatus().state === "ready" ? "ready" : ""}">
      <h1>WUNO WhatsApp Bot</h1>
      <div class="status"><span class="dot"></span>${getBotStatus().label}</div>
      ${getBotStatus().qrDataUrl ? `<img src="${getBotStatus().qrDataUrl}" alt="QR WhatsApp untuk WUNO" />` : ""}
      <p>${getBotStatus().message}</p>
      <p class="hint">Halaman ini memperbarui otomatis. Setelah terhubung, kirim <code>U# help</code> ke nomor bot.</p>
    </main>
  </body>
</html>`);
});

router.get("/bot-status", (_req, res) => {
  const status = getBotStatus();
  res.json({
    state: status.state,
    label: status.label,
    message: status.message,
    hasQr: Boolean(status.qrDataUrl),
    updatedAt: status.updatedAt,
  });
});

export default router;