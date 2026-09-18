import { requiredJoinGameSession } from "../utils";
import {
  findPlayerTargetFromArgs,
  formatPlayerMatches,
} from "../utils/playerTarget";

export default requiredJoinGameSession(async ({ chat, game }) => {
  /**
   * Pastikan game benar-benar tersedia sebelum mengakses game.players.
   */
  if (!game) {
    return await chat.replyToCurrentPerson(
      "Sebuah kesalahan, game tidak ditemukan!",
    );
  }

  /**
   * Pastikan ada pemain lain di dalam game.
   */
  if (game.players.length < 1) {
    return await chat.replyToCurrentPerson(
      "Tidak ada lawan bicara yang bisa diajak berkomunikasi.",
    );
  }

  /**
   * Default:
   * Kirim ke semua pemain lain dalam game.
   */
  let playerList = game.players.filter(
    (player) => player.playerId !== chat.user!.id,
  );

  /**
   * Argumen setelah command.
   *
   * Contoh:
   * U#say halo semuanya
   * -> "halo semuanya"
   *
   * U#sayto Budi halo
   * -> diproses lagi di blok targetOnly
   */
  let message = chat.args.join(" ");

  /**
   * ============================================================
   * TARGET PLAYER
   * ============================================================
   *
   * Digunakan oleh U#sayto.
   *
   * Contoh:
   * U#sayto Budi halo
   * U#sayto 628123456789 halo
   */
  if (chat.targetOnly) {
    if (chat.args.length === 0) {
      return await chat.replyToCurrentPerson(
        "Gunakan format: U#sayto <nama atau nomor> <pesan>.",
      );
    }

    const players = await game.getAllPlayerUserObject();

    const target = findPlayerTargetFromArgs(
      players.filter((player) => player?.id !== chat.user!.id),
      chat.args,
    );

    /**
     * Lebih dari satu pemain memiliki nama yang cocok.
     */
    if (target.matches.length > 1) {
      return await chat.replyToCurrentPerson(
        `Nama "${target.identifier}" cocok dengan beberapa pemain: ${formatPlayerMatches(
          target.matches,
        )}. Sebutkan nama yang lebih lengkap atau nomor WhatsApp.`,
      );
    }

    const targetPlayerUser = target.matches[0];

    /**
     * Tidak menemukan target.
     */
    if (!targetPlayerUser) {
      return await chat.replyToCurrentPerson(
        `Tidak ada pemain dengan nama atau nomor "${target.identifier}" di game ini.`,
      );
    }

    /**
     * Cari player tersebut di game yang sedang aktif.
     */
    const targetPlayer = game.players.find(
      (player) => player.playerId === targetPlayerUser.id,
    );

    if (!targetPlayer) {
      return await chat.replyToCurrentPerson(
        "Pemain tersebut tidak sedang berada di game ini.",
      );
    }

    /**
     * Untuk sayto, hanya kirim ke target tersebut.
     */
    playerList = [targetPlayer];

    /**
     * findPlayerTargetFromArgs() juga mengambil sisa argumen
     * sebagai isi pesan.
     */
    message = target.message;
  }

  /**
   * ============================================================
   * MEDIA DARI PESAN YANG DI-QUOTE / DIREPLY
   * ============================================================
   *
   * Contoh:
   * reply sebuah gambar
   * U#say
   *
   * atau:
   * reply sebuah sticker
   * U#sayto Budi
   */
  const {
    hasQuotedMessage,
    quotedMessage,
    quotedMessageMedia,
    mediaDownloadError: quotedMediaDownloadError,
    quoteLookupError: quotedMessageLookupError,
  } = await chat.hasQuotedMessageMedia();

  /**
   * Media quote gagal di-download.
   */
  if (quotedMediaDownloadError) {
    return await chat.replyToCurrentPerson(
      "Media yang dibalas tidak bisa diunduh. Minta pengirim mengirim ulang media tersebut.",
    );
  }

  /**
   * Kalau pesan yang dibalas memang memiliki media
   * dan media berhasil diperoleh.
   */
  if (hasQuotedMessage && quotedMessageMedia && quotedMessage) {
    /**
     * ==========================================================
     * GIF
     * ==========================================================
     */
    if (
      quotedMessage.isGif ||
      quotedMessageMedia.mimetype === "image/gif"
    ) {
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

    /**
     * ==========================================================
     * STICKER
     * ==========================================================
     *
     * Sticker WhatsApp umumnya berupa image/webp.
     *
     * Kita pertahankan pengecekan body kosong seperti kode kamu.
     */
    if (
      quotedMessageMedia.mimetype === "image/webp" &&
      quotedMessage.body === ""
    ) {
      await game.sendToSpecificPlayerList(
        {
          sendMediaAsSticker: true,
        },
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

    /**
     * ==========================================================
     * HANYA IZINKAN IMAGE
     * ==========================================================
     */
    if (!quotedMessageMedia.mimetype.startsWith("image/")) {
      await chat.replyToCurrentPerson(
        "Pesan yang bisa dikutip hanya berupa gambar, gif, dan sticker!",
      );

      return;
    }

    /**
     * ==========================================================
     * GAMBAR
     * ==========================================================
     */
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

  /**
   * ============================================================
   * MEDIA DARI PESAN SAAT INI
   * ============================================================
   *
   * Contoh:
   * U#say + attach gambar
   * U#say + attach sticker
   *
   * Atau:
   * U#sayto Budi + attach gambar
   * U#sayto Budi + attach sticker
   */
  const {
    hasMedia,
    currentChat,
    currentMedia,
    mediaDownloadError: currentMediaDownloadError,
  } = await chat.hasMediaInCurrentChat();

  /**
   * Media pesan saat ini gagal di-download.
   */
  if (currentMediaDownloadError) {
    return await chat.replyToCurrentPerson(
      "Media tidak bisa diunduh. Minta pengirim mengirim ulang media tersebut.",
    );
  }

  /**
   * Kalau pesan saat ini memiliki media dan media berhasil diperoleh.
   */
  if (hasMedia && currentMedia) {
    /**
     * ==========================================================
     * GIF
     * ==========================================================
     */
    if (
      currentChat.isGif ||
      currentMedia.mimetype === "image/gif"
    ) {
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

    /**
     * ==========================================================
     * STICKER
     * ==========================================================
     *
     * Sticker bisa dideteksi berdasarkan:
     * - currentChat.type === "sticker"
     * - mimetype image/webp + body kosong
     */
    if (
      currentChat.type === "sticker" ||
      (
        currentMedia.mimetype === "image/webp" &&
        currentChat.body.trim() === ""
      )
    ) {
      await game.sendToSpecificPlayerList(
        {
          sendMediaAsSticker: true,
        },
        playerList,
        currentMedia,
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

    /**
     * ==========================================================
     * HANYA IZINKAN IMAGE
     * ==========================================================
     */
    if (!currentMedia.mimetype.startsWith("image/")) {
      await chat.replyToCurrentPerson(
        "Pesan yang bisa dikutip hanya berupa gambar, gif, dan sticker!",
      );

      return;
    }

    /**
     * ==========================================================
     * GAMBAR
     * ==========================================================
     */
    await game.sendToSpecificPlayerList(
      {
        caption:
          message === ""
            ? `Gambar dari ${chat.message.userName}`
            : `${chat.message.userName}: ${message}`,
      },
      playerList,
      currentMedia,
    );

    await chat.reactToCurrentPerson("👍");

    return;
  }

  /**
   * ============================================================
   * QUOTE LOOKUP ERROR
   * ============================================================
   *
   * Ini diletakkan setelah pengecekan media current message.
   * Jadi kalau pesan sekarang sendiri memiliki media,
   * media tersebut tetap bisa diproses.
   */
  if (quotedMessageLookupError) {
    return await chat.replyToCurrentPerson(
      "Pesan yang dibalas tidak bisa dibuka oleh WhatsApp. Kirim ulang media lalu gunakan perintah say pada pesan baru.",
    );
  }

  /**
   * ============================================================
   * TEXT MESSAGE
   * ============================================================
   */
  if (message === "") {
    await chat.replyToCurrentPerson("Pesan tidak boleh kosong!");
    return;
  }

  /**
   * ============================================================
   * SEND TEXT
   * ============================================================
   */
  await game.sendToSpecificPlayerList(
    `${chat.message.userName}: ${message}`,
    playerList,
  );

  /**
   * React setelah berhasil mengirim.
   */
  await chat.reactToCurrentPerson("👍");
});