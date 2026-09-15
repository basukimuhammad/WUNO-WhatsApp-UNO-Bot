import { prisma } from "../handler/database";
import { requiredJoinGameSession } from "../utils";
import { normalizePhoneNumber } from "../utils";

export default requiredJoinGameSession(async ({ chat, game, card }) => {
  if (!game.state.PLAYING) {
    return await chat.replyToCurrentPerson(
      "UNO hanya bisa digunakan saat permainan sedang berlangsung.",
    );
  }

  const callerId = chat.user!.id;
  const callerCardCount = card.cards.length;

  if (callerCardCount === 1) {
    if (await game.hasCalledUno(callerId)) {
      return await chat.replyToCurrentPerson(
        "Kamu sudah mengatakan UNO untuk giliran ini.",
      );
    }

    await game.setUnoCalled(callerId, true);
    const otherPlayers = game.players.filter(
      (player) => player.playerId !== callerId,
    );
    await Promise.all([
      chat.replyToCurrentPerson(
        "UNO tercatat. Kamu aman dari penalti dua kartu.",
      ),
      game.sendToSpecificPlayerList(
        `${chat.message.userName} mengatakan UNO dan aman dari penalti.`,
        otherPlayers,
      ),
    ]);
    return;
  }

  const oneCardPlayers = [];
  for (const player of game.players) {
    if (player.playerId === callerId) continue;
    if ((await game.getPlayerCardCount(player.playerId)) !== 1) continue;
    if (await game.hasCalledUno(player.playerId)) continue;
    const user = await prisma.user.findUnique({
      where: { id: player.playerId },
    });
    if (user) oneCardPlayers.push({ player, user });
  }

  if (oneCardPlayers.length === 0) {
    return await chat.replyToCurrentPerson(
      "Tidak ada pemain dengan satu kartu yang bisa dipanggil UNO.",
    );
  }

  const requestedTarget = normalizePhoneNumber(chat.args.join(" "));
  const target =
    oneCardPlayers.length === 1
      ? oneCardPlayers[0]
      : oneCardPlayers.find(
          ({ user }) =>
            normalizePhoneNumber(user.phoneNumber) === requestedTarget,
        );

  if (!target) {
    return await chat.replyToCurrentPerson(
      `Ada ${oneCardPlayers.length} pemain yang lupa mengatakan UNO. Sertakan nomor target, contoh: U# uno 628123456789.`,
    );
  }

  const addedCards = await game.addCardsToPlayer(target.player.playerId, 2);
  const recipients = game.players.filter(
    (player) => player.playerId !== target.player.playerId,
  );

  await Promise.all([
    chat.replyToCurrentPerson(
      `Benar! ${target.user.phoneNumber} terlambat mengatakan UNO dan mendapat 2 kartu penalti: ${addedCards
        .map((item) => `*${item}*`)
        .join(", ")}.`,
    ),
    chat.sendToOtherPerson(
      target.user.phoneNumber,
      `Kamu terlambat mengatakan UNO. Kamu mendapat 2 kartu penalti: ${addedCards
        .map((item) => `*${item}*`)
        .join(", ")}.`,
    ),
    game.sendToSpecificPlayerList(
      `${target.user.phoneNumber} terlambat mengatakan UNO dan mendapat 2 kartu penalti.`,
      recipients.filter((player) => player.playerId !== callerId),
    ),
  ]);
});