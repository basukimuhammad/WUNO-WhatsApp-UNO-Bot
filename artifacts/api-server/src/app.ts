import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startBot } from "./wuno";
import { gameCenterHtml } from "./wuno/gameCenter";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.get("/", (_req, res) => {
  res.type("text/plain").send("WUNO WhatsApp UNO Bot is running.");
});

app.get("/wuno/game", (_req, res) => {
  res.type("html").send(gameCenterHtml);
});

export async function startWunoBot() {
  logger.info("[BOT] Starting WUNO bot initialization...");
  try {
    await startBot();
    logger.info("[BOT] WUNO bot initialization completed.");
  } catch (error) {
    logger.error({ err: error }, "[BOT] Bot initialization failed");
    // Do not crash the HTTP/WebSocket server if WhatsApp initialization fails.
    // The deployment can stay healthy and the error remains visible in logs.
  }
}

export default app;
