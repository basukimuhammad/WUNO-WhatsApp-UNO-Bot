import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import QRCode from "qrcode";
import PQueue from "p-queue";
import pLimit from "p-limit";
import path from "path";
import P from "pino";

import { messageHandler } from "./handler/message";
import { df as formatTime } from "./utils/index";
import { prisma } from "./handler/database";
import { env } from "./env";
import { updateBotStatus } from "./status";

import type { Logger } from "pino";

const PQueueConstructor =
  (PQueue as unknown as { default?: typeof PQueue }).default ?? PQueue;

export default class Bot {
  private logger: Logger;

  private queue = new PQueueConstructor({
    concurrency: 4,
    autoStart: false,
  });
  private messageLimitter = pLimit(8);
  private waClient: Client;

  constructor(clientId: string) {
    this.waClient = new Client({
      authStrategy: new LocalAuth({ clientId }),
      pairWithPhoneNumber: {
        phoneNumber: env.PAIRING_PHONE_NUMBER,
        showNotification: true,
        intervalMs: 180000,
      },
      puppeteer: {
        executablePath: env.CHROME_PATH,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });

    this.logger = P({
      transport: {
        targets: [
          {
            target: "pino-pretty",
            level: "debug",
            options: {
              colorize: true,
              ignore: "pid,hostname",
              translateTime: "SYS:standard",
            },
          },
          {
            target: "pino/file",
            level: "debug",
            options: {
              destination: path.join(__dirname, "..", `${clientId}-bot.log`),
            },
          },
        ],
      },
    });

    this.waClient.on("qr", (qr) => {
      qrcode.generate(qr, { small: true });
      void QRCode.toDataURL(qr, { margin: 1, width: 320 })
        .then((dataUrl) => {
          updateBotStatus(
            "qr",
            "Buka QR ini, lalu di WhatsApp pilih Setelan > Perangkat tertaut > Tautkan perangkat.",
            dataUrl,
            null,
          );
        })
        .catch((error: unknown) => {
          this.logger.error({ err: error }, "[BOT] Gagal membuat QR data URL");
          updateBotStatus(
            "error",
            "QR WhatsApp gagal dibuat. Periksa log layanan untuk detail error.",
            null,
            null,
          );
        });
    });
    this.waClient.on("code", (code) => {
      this.logger.info(`[BOT] Kode pairing WhatsApp: ${code}`);
      updateBotStatus(
        "pairing_code",
        "Masukkan kode ini di WhatsApp pada perangkat yang ingin ditautkan. Kode diperbarui berkala.",
        null,
        code,
      );
    });
    this.waClient.on("ready", () => {
      this.logger.info("[BOT] Siap digunakan");
      updateBotStatus(
        "ready",
        `Bot sudah terhubung. Prefix perintah: ${env.PREFIX}`,
        null,
        null,
      );
      this.waClient.setStatus(
        `Ketik "${
          env.PREFIX
        }" untuk memulai percakapan! Dinyalakan pada ${formatTime(
          new Date(),
        )}.`,
      );
    });
    this.waClient.on("authenticated", () =>
      (() => {
        this.logger.info("[BOT] Berhasil melakukan proses autentikasi");
        updateBotStatus(
          "authenticated",
          "WhatsApp berhasil diautentikasi. Menunggu bot siap digunakan.",
          null,
          null,
        );
      })(),
    );
    this.waClient.on("change_state", (state) =>
      this.logger.info(`[BOT] State bot berubah, saat ini: ${state}`),
    );
    this.waClient.on("disconnected", (reason) => {
      this.logger.warn(`[BOT] WhatsApp terputus: ${reason}`);
      updateBotStatus(
        "disconnected",
        `WhatsApp terputus (${reason}). Restart layanan untuk menautkan ulang.`,
        null,
        null,
      );
    });
    this.waClient.on("auth_failure", (message) => {
      this.logger.error(`[BOT] Autentikasi gagal: ${message}`);
      updateBotStatus("auth_failure", message, null, null);
    });

    this.queue.start();
  }

  /**
   * The main entrance gate for this bot is working
   */
  async init() {
    this.logger.info("[INIT] Inisialisasi bot");

    const onMessageQueue = await messageHandler(
      this.waClient,
      this.logger,
      this.messageLimitter,
    );

    this.waClient.on("message", (message) => {
      if (typeof message.body !== "string" || !message.body.startsWith(env.PREFIX)) {
        return;
      }

      void (async () => {
        try {
          const contact = await message.getContact();
          this.logger.info(`[Pesan] Ada pesan dari: ${contact.pushname}`);
          await this.queue.add(() => onMessageQueue(message, contact));
        } catch (error) {
          this.logger.error({ err: error }, "[BOT] Gagal memproses pesan masuk");
          try {
            await message.reply("Terjadi kesalahan saat memproses pesan. Silakan coba lagi.");
          } catch (replyError) {
            this.logger.error({ err: replyError }, "[BOT] Gagal mengirim pesan error ke pengguna");
          }
        }
      })();
    });

    try {
      await prisma.$connect();
      this.logger.info("[DB] Berhasil terhubung dengan database");
      this.logger.info("[BOT] Menyalakan bot");
      updateBotStatus("starting", "Database siap. Menyalakan WhatsApp Web.");
      await this.waClient.initialize();
    } catch (error) {
      this.logger.error({ error }, "[INIT] Gagal menyalakan bot");
      updateBotStatus(
        "error",
        "Bot gagal menyala. Periksa log layanan untuk detail error.",
        null,
        null,
      );
    }
  }
}
