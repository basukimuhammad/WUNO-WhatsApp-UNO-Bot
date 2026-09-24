import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startBot } from "./wuno";
import { gameCenterHtml } from "./wuno/gameCenter";
import { updateBotStatus } from "./wuno/status";

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

app.get("/wuno/game", (_req, res) => {
  res.type("html").send(gameCenterHtml);
});

void startBot().catch((error: unknown) => {
  logger.error({ err: error }, "[BOT] Gagal menyalakan bot");
  updateBotStatus(
    "error",
    "Bot gagal menyala. Periksa log layanan untuk detail error.",
    null,
    null,
  );
});

export default app;
