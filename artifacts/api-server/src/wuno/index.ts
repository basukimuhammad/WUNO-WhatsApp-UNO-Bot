import Bot from "./bot";

let bot: Bot | undefined;

export async function startBot() {
  if (bot) return;
  bot = new Bot("WUNO_BOT");
  await bot.init();
}
