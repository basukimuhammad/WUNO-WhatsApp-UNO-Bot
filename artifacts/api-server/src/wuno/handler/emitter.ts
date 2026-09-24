import EventEmitter from "events";
import { getController } from "./controller";

import { findOrCreateUser, isDMChat } from "../utils";
import { handleHelpCommand } from "./help";
import type { Chat } from "../lib/Chat";

export const emitHandler = (
  controller: Awaited<ReturnType<typeof getController>>,
) => {
  const messageHandler = new EventEmitter();
  const safeController =
    (name: string, callback: (chat: Chat) => Promise<void>) =>
    async (chat: Chat) => {
      try {
        await callback(chat);
      } catch (error) {
        chat.logger.error({ err: error, command: name }, "[COMMAND] Gagal menjalankan perintah");
        try {
          await chat.replyToCurrentPerson(
            "Terjadi kesalahan saat menjalankan perintah. Silakan coba lagi.",
          );
        } catch (replyError) {
          chat.logger.error(
            { err: replyError, command: name },
            "[COMMAND] Gagal mengirim balasan error",
          );
        }
      }
    };

  messageHandler.on("leaderboard", safeController("leaderboard", controller.leaderboard));
  messageHandler.on("creategame", safeController("creategame", findOrCreateUser(controller.creategame)));
  messageHandler.on("joingame", safeController("joingame", findOrCreateUser(controller.joingame)));
  messageHandler.on("infogame", safeController("infogame", findOrCreateUser(controller.infogame)));
  messageHandler.on("game", safeController("game", controller.game));
  messageHandler.on("startgame", safeController("startgame", isDMChat(findOrCreateUser(controller.startgame))));
  messageHandler.on("endgame", safeController("endgame", isDMChat(findOrCreateUser(controller.endgame))));
  messageHandler.on("leavegame", safeController("leavegame", isDMChat(findOrCreateUser(controller.leavegame))));
  messageHandler.on("play", safeController("play", isDMChat(findOrCreateUser(controller.play))));
  messageHandler.on("say", safeController("say", isDMChat(findOrCreateUser(controller.say))));
  messageHandler.on("cards", safeController("cards", isDMChat(findOrCreateUser(controller.cards))));
  messageHandler.on("draw", safeController("draw", isDMChat(findOrCreateUser(controller.draw))));
  messageHandler.on("kick", safeController("kick", isDMChat(findOrCreateUser(controller.kick))));
  messageHandler.on("ban", safeController("ban", isDMChat(findOrCreateUser(controller.ban))));
  messageHandler.on("unban", safeController("unban", isDMChat(findOrCreateUser(controller.unban))));
  messageHandler.on("uno", safeController("uno", isDMChat(findOrCreateUser(controller.uno))));
  messageHandler.on("help", safeController("help", handleHelpCommand(controller)));

  return messageHandler;
};
