import Bot from "./bot";
import { startRichClient } from "./rich/client";

let bot: Bot | undefined;

export async function startBot() {
  if (bot) return;
  bot = new Bot("WUNO_BOT");
  void startRichClient();
  await bot.init();
}
