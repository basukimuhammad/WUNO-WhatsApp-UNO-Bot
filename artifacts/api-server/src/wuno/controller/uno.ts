import { prisma } from "../handler/database";
import type { Player, User } from "../handler/database";
import { requiredJoinGameSession } from "../utils";
import {
  findPlayersByIdentifier,
  formatPlayerMatches,
} from "../utils";

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
        "UNO tercatat. Kamu aman dari penalti satu kartu.",
      ),
      game.sendToSpecificPlayerList(
        `${chat.message.userName} mengatakan UNO dan aman dari penalti.`,
        otherPlayers,
      ),
    ]);
    return;
  }

  const oneCardPlayers: Array<{ player: Player; user: User }> = [];
  for (const player of game.players) {
    if (player.playerId === callerId) continue;
    if ((await game.getPlayerCardCount(player.playerId)) !== 1) continue;
    if (!(await game.hasPendingUno(player.playerId))) continue;
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

  const requestedTarget = chat.args.join(" ").trim();
  let target: (typeof oneCardPlayers)[number] | undefined = oneCardPlayers[0];

  if (requestedTarget) {
    const matches = findPlayersByIdentifier(
      oneCardPlayers.map(({ user }) => user),
      requestedTarget,
    );

    if (matches.length > 1) {
      return await chat.replyToCurrentPerson(
        `Nama "${requestedTarget}" cocok dengan beberapa pemain: ${formatPlayerMatches(matches)}. Sebutkan nama yang lebih lengkap atau nomor WhatsApp.`,
      );
    }

    target = oneCardPlayers.find(
      ({ user }) => user.id === matches[0]?.id,
    );
  }

  if (!target) {
    return await chat.replyToCurrentPerson(
      `Pemain "${requestedTarget}" tidak sedang berada dalam kesempatan UNO. Pemain terbaru yang tinggal satu kartu bisa dipanggil dengan U# uno.`,
    );
  }

  const addedCards = await game.addCardsToPlayer(target.player.playerId, 1);
  const recipients = game.players.filter(
    (player) => player.playerId !== target.player.playerId,
  );

  await Promise.all([
    chat.replyToCurrentPerson(
        `Benar! ${target.user.username} terlambat mengatakan UNO dan mendapat 1 kartu penalti: ${addedCards
        .map((item) => `*${item}*`)
        .join(", ")}.`,
    ),
    chat.sendToOtherPerson(
      target.user.phoneNumber,
      `Kamu terlambat mengatakan UNO. Kamu mendapat 1 kartu penalti: ${addedCards
        .map((item) => `*${item}*`)
        .join(", ")}.`,
    ),
    game.sendToSpecificPlayerList(
      `${target.user.username} terlambat mengatakan UNO dan mendapat 1 kartu penalti.`,
      recipients.filter((player) => player.playerId !== callerId),
    ),
  ]);
});