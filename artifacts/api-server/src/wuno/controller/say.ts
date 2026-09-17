import { requiredJoinGameSession } from "../utils";
import {
  findPlayerTargetFromArgs,
  formatPlayerMatches,
} from "../utils/playerTarget";

export default requiredJoinGameSession(async ({ chat, game }) => {
  const targetQuery = chat.targetOnly
    ? chat.args[0]?.replace(/^@/, "").trim()
    : undefined;
  const messageArgs = chat.targetOnly ? chat.args.slice(1) : chat.args;
  const message = messageArgs.join(" ");

  if (!game) {
    return await chat.replyToCurrentPerson(
      "Sebuah kesalahan, game tidak ditemukan!",
    );
  } else if (game.players!.length < 1) {
    return await chat.replyToCurrentPerson(
      "Tidak ada lawan bicara yang bisa diajak berkomunikasi.",
    );
  }

    let playerList = game.players.filter(
    (player) => player.playerId !== chat.user!.id,
  );
  if (chat.targetOnly) {
    if (!targetQuery) {
      return await chat.replyToCurrentPerson(
        "Gunakan format: U# sayto <nama atau nomor> <pesan>.",
      );
    }

    const players = await game.getAllPlayerUserObject();
    const matches = findPlayersByIdentifier(
      players.filter((player) => player?.id !== chat.user!.id),
      targetQuery,
    );

    if (matches.length > 1) {
      return await chat.replyToCurrentPerson(
        `Nama "${targetQuery}" cocok dengan beberapa pemain: ${formatPlayerMatches(matches)}. Sebutkan nama yang lebih lengkap atau nomor WhatsApp.`,
      );
    }

    const target = matches[0];
    if (!target) {
      return await chat.replyToCurrentPerson(
        `Tidak ada pemain dengan nama atau nomor "${targetQuery}" di game ini.`,
      );
    }

    const targetPlayer = game.players.find(
      (player) => player.playerId === target.id,
    );
    if (!targetPlayer) {
      return await chat.replyToCurrentPerson(
        "Pemain tersebut tidak sedang berada di game ini.",
      );
    }

    playerList = [targetPlayer];
  }

  // Media handler
  const { hasQuotedMessage, quotedMessage, quotedMessageMedia } =
    await chat.hasQuotedMessageMedia();

  if (hasQuotedMessage && quotedMessageMedia) {
    // If the quoted message is a gif
    if (quotedMessage.isGif) {
      await game.sendToSpecificPlayerList(
        {
          sendVideoAsGif: true,
          caption:
            message === ""
              ? `GIF dari ${chat.message.userName}`
              : `${chat.message.userName}: ${message}`,
        },
        playerList,
        quotedMessageMedia,
      );

      await chat.reactToCurrentPerson("👍");

      return;
    }

    // Check if it's not an image
    if (!quotedMessageMedia.mimetype.startsWith("image/")) {
      await chat.replyToCurrentPerson(
        "Pesan yang bisa dikutip hanya berupa gambar, gif, dan sticker!",
      );

      return;
    }

    // It's a sticker
    if (
      quotedMessageMedia.mimetype === "image/webp" &&
      quotedMessage.body === ""
    ) {
      await game.sendToSpecificPlayerList(
        { sendMediaAsSticker: true },
        playerList,
        quotedMessageMedia,
      );

      await game.sendToSpecificPlayerList(
        message === ""
          ? `Sticker dari ${chat.message.userName}`
          : `${chat.message.userName}: ${message}`,
        playerList,
      );

      await chat.reactToCurrentPerson("👍");

      return;
    }

    await game.sendToSpecificPlayerList(
      {
        caption:
          message === ""
            ? `Gambar dari ${chat.message.userName}`
            : `${chat.message.userName}: ${message}`,
      },
      playerList,
      quotedMessageMedia,
    );

    await chat.reactToCurrentPerson("👍");

    return;
  }

  const { hasMedia, currentChat, currentMedia } =
    await chat.hasMediaInCurrentChat();

  if (hasMedia && currentMedia) {
    // If the quoted message is a gif
    if (currentChat.isGif) {
      await game.sendToSpecificPlayerList(
        {
          sendVideoAsGif: true,
          caption:
            message === ""
              ? `GIF dari ${chat.message.userName}`
              : `${chat.message.userName}: ${message}`,
        },
        playerList,
        currentMedia,
      );

      await chat.reactToCurrentPerson("👍");

      return;
    }

    // Check if it's not an image
    if (!currentMedia.mimetype.startsWith("image/")) {
      await chat.replyToCurrentPerson(
        "Pesan yang bisa dikutip hanya berupa gambar, gif, dan sticker!",
      );

      return;
    }

    await game.sendToSpecificPlayerList(
      {
        caption:
          message === ""
            ? `Gambar dari ${chat.message.userName}`
            : `${chat.message.userName}: ${message}`,
      },
      playerList,
      quotedMessageMedia,
    );

    await chat.reactToCurrentPerson("👍");

    return;
  }
  // End of media handler

  if (message === "") {
    await chat.replyToCurrentPerson("Pesan tidak boleh kosong!");
    return;
  }

  await game.sendToSpecificPlayerList(
    `${chat.message.userName}: ${message}`,
    playerList,
  );

  await chat.reactToCurrentPerson("👍");
});
