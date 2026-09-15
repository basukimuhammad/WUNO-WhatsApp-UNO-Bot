import { requiredJoinGameSession } from "../utils";
import { findPlayersByIdentifier, formatPlayerMatches } from "../utils";

export default requiredJoinGameSession(async ({ chat, game }) => {
  if (!game.isGameCreator)
    return await chat.replyToCurrentPerson("Kamu bukan pembuat gamenya!");

  const message = chat.args.join(" ").trim();
  const bannedPlayers = await game.getAllBannedPlayerUserObject();

  if (message === "")
    return await chat.replyToCurrentPerson(
      "Sebutkan nama atau nomor WhatsApp pemain yang ingin di-unban. Nama boleh sebagian, contoh: U# unban uki atau U# unban 628123456789.",
    );

  const matches = findPlayersByIdentifier(bannedPlayers, message);
  if (matches.length > 1) {
    return await chat.replyToCurrentPerson(
      `Nama "${message}" cocok dengan beberapa pemain: ${formatPlayerMatches(matches)}. Sebutkan nama yang lebih lengkap atau nomor WhatsApp.`,
    );
  }

  const player = matches[0];
  if (!player)
    return await chat.replyToCurrentPerson(
      `Tidak ada pemain dengan nama atau nomor "${message}" di daftar ban permainan ini.`,
    );

  const removed = await game.removeUserFromBannedList(player.id);
  if (!removed)
    return await chat.replyToCurrentPerson(
      "Ban pemain tersebut sudah tidak ditemukan atau sudah dihapus.",
    );

  await chat.replyToCurrentPerson(
    `Berhasil unban ${player.username}. Dia sekarang bisa join kembali ke permainan ini.`,
  );
});
