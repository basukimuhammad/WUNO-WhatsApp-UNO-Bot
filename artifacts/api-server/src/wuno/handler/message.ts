import type { Client, Contact, Message } from "whatsapp-web.js";
import pLimit from "p-limit";
import { Logger } from "pino";

import { env } from "../env";
import { Chat } from "../lib/Chat";
import { emitHandler } from "./emitter";
import { getController } from "./controller";
import { findOrCreateUser, isDMChat, requiredJoinGameSession } from "../utils";

import { botInfo } from "../config/messages";
import { normalizeCardInput } from "../config/cards";

/**
 * A "bone" for this bot handling incoming messages whatsoever
 * @param client whatsapp-web.js client instance
 * @param logger pino logger instance
 * @param limitter p-limit instance
 * @returns A function that can be used for queue callback
 */
export const messageHandler = async (
  client: Client,
  logger: Logger,
  limitter: ReturnType<typeof pLimit>,
) => {
  const controller = await getController();
  const emitter = emitHandler(controller);
  const listBanHandler = isDMChat(
    findOrCreateUser(
      requiredJoinGameSession(async ({ chat, game }) => {
        if (!game.isGameCreator) {
          await chat.replyToCurrentPerson("Kamu bukan pembuat gamenya!");
          return;
        }

        const bannedPlayers = await game.getAllBannedPlayerUserObject();
        if (bannedPlayers.length === 0) {
          await chat.replyToCurrentPerson(
            "Belum ada pemain yang di-ban di game ini.",
          );
          return;
        }

        await chat.replyToCurrentPerson(
          `Daftar pemain yang di-ban:\n${bannedPlayers
            .map(
              (player, index) =>
                `${index + 1}. ${player.username} (${player.phoneNumber.replace(/@c\.us$/i, "")})`,
            )
            .join("\n")}`,
        );
      }),
    ),
  );
  
  return async (message: Message, contact: Contact) => {
    const command = message.body
      .slice(env.PREFIX.length)!
      .trim()!
      .split(/ +/)!
      .shift()!
      .toLowerCase();

    const chat = new Chat(client, message, logger, limitter, contact);
    const implicitCard = normalizeCardInput(command);

    if (implicitCard) {
      chat.args = [implicitCard, ...chat.args];
      emitter.emit("play", chat);
      return;
    }

    switch (command) {
      case "cg":
      case "create":
      case "creategame":
        emitter.emit("creategame", chat);
        break;
      case "sg":
      case "start":
      case "startgame":
        emitter.emit("startgame", chat);
        break;
      case "j":
      case "jg":
      case "join":
      case "joingame":
        emitter.emit("joingame", chat);
        break;
      case "i":
      case "ig":
      case "info":
      case "infogame":
        emitter.emit("infogame", chat);
        break;
      case "eg":
      case "end":
      case "endgame":
        emitter.emit("endgame", chat);
        break;

      case "l":
      case "lg":
      case "quit":
      case "leave":
      case "leavegame":
        emitter.emit("leavegame", chat);
        break;
      case "leaderboard":
      case "board":
      case "lb":
        emitter.emit("leaderboard", chat);
        break;
      case "p":
      case "play":
        emitter.emit("play", chat);
        break;
      case "s":
      case "say":
        emitter.emit("say", chat);
        break;
      case "st":
      case "sayto":
        chat.targetOnly = true;
        emitter.emit("say", chat);
        break;
      case "c":
      case "cards":
        emitter.emit("cards", chat);
        break;
      case "d":
      case "pickup":
      case "newcard":
      case "draw":
        emitter.emit("draw", chat);
        break;
      case "k":
      case "kick":
        emitter.emit("kick", chat);
        break;
      case "b":
      case "ban":
        emitter.emit("ban", chat);
        break;
      case "ub":
      case "unban":
        emitter.emit("unban", chat);
        break;
      case "listban":
      case "lban":
        await listBanHandler(chat);
        break;
      case "uno":
        emitter.emit("uno", chat);
        break;
      case "game":
      case "games":
      case "gamecenter":
        emitter.emit("game", chat);
        break;
      case "h":
      case "help":
        emitter.emit("help", chat);
        break;

      default: {
        await chat.sendToCurrentPerson(
          command.length > 0
            ? `Tidak ada perintah yang bernama "${command}"`
            : botInfo,
        );
        break;
      }
    }
  };
};
