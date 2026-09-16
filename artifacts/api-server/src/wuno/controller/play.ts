import { requiredJoinGameSession } from "../utils";
import { Card } from "../lib";

import {
  regexValidNormal,
  regexValidWildColorOnly,
  regexValidWildColorPlus4Only,
} from "../config/cards";
import { env } from "../env";
import type { allCard } from "../config/cards";
import { normalizeCardInput } from "../config/cards";

const isValidWildOrPlus4 = (card: string) => {
  return (
    card.match(regexValidWildColorOnly) ||
    card.match(regexValidWildColorPlus4Only)
  );
};

const guessCardIsAlmostValidWildOrPlus4 = (card: string, cardLib: Card) => {
  return (
    card.includes("wild") &&
    !isValidWildOrPlus4(card) &&
    ["red", "green", "blue", "yellow"]
      .map((color) => `${card}${color}`)
      .every((guessedCard) => cardLib.isIncluded(guessedCard))
  );
};

export default requiredJoinGameSession(async ({ chat, game, card }) => {
  const joinedCard = normalizeCardInput(chat.args.join(""));
  const requestedCards = chat.args.map((input) => normalizeCardInput(input));
  const requestedCardNames = requestedCards.filter(
    (requestedCard): requestedCard is allCard => Boolean(requestedCard),
  );
  const requestedNumbers = requestedCardNames.map((requestedCard) =>
    requestedCard.match(/[0-9]$/)?.[0],
  );
  const isBatchPlay = chat.args.length > 1 && !joinedCard;
  const choosenCard = joinedCard ?? requestedCards[0] ?? "";

  if (game.isCurrentChatTurn) {
    if (chat.args.length < 1 || choosenCard === "") {
      await chat.replyToCurrentPerson("Diperlukan kartu yang ingin dimainkan!");
    } else if (isBatchPlay) {
      if (requestedCards.some((requestedCard) => !requestedCard)) {
        await chat.replyToCurrentPerson(
          "Salah satu input bukan kartu yang valid. Gunakan nama kartu lengkap atau singkat, misalnya red5 atau r5.",
        );
      } else if (
        requestedNumbers.some((number) => number !== requestedNumbers[0])
      ) {
        await chat.replyToCurrentPerson(
          "Kalau ingin menaruh beberapa kartu sekaligus, semua kartunya harus memiliki angka yang sama. Warnanya boleh berbeda.",
        );
      } else if (!regexValidNormal.test(choosenCard)) {
        await chat.replyToCurrentPerson(
          "Kartu ganda hanya bisa digunakan untuk kartu angka yang sama, meskipun warnanya berbeda. Kartu aksi dan kartu wild tetap dimainkan satu per satu.",
        );
      } else if (
        requestedCardNames.some(
          (requestedCard) =>
            requestedCardNames.filter(
              (cardName) => cardName === requestedCard,
            ).length >
            card.cards.filter((playerCard) => playerCard === requestedCard)
              .length,
        )
      ) {
        await chat.replyToCurrentPerson(
          "Kamu tidak memiliki semua kartu yang diminta dalam jumlah yang cukup.",
        );
      } else if (
        !(await card.solveMultipleSameNumberCards(requestedCardNames))
      ) {
        await chat.replyToCurrentPerson(
          `Kartu *${choosenCard}* tidak valid jika disandingkan dengan kartu *${game.currentCard}*! Jika tidak memiliki kartu lagi, ambil dengan '${env.PREFIX}d' untuk mengambil kartu baru.`,
        );
      }
    } else if (guessCardIsAlmostValidWildOrPlus4(choosenCard, card)) {
      await chat.replyToCurrentPerson(
        `Kamu memiliki kartu ${choosenCard} tetapi belum ada warnanya.

Coba tetapkan warna di antara warna \`\`\`red\`\`\` (merah), \`\`\`green\`\`\` (hijau), \`\`\`blue\`\`\` (biru), atau \`\`\`yellow\`\`\` (kuning) dengan menggunakan perintah

  \`\`\`${env.PREFIX}p ${choosenCard} <warna yang di inginkan>\`\`\``,
      );
    } else if (!Card.isValidCard(choosenCard)) {
      await chat.replyToCurrentPerson(`${choosenCard} bukanlah sebuah kartu!`);
    } else if (!card.isIncluded(choosenCard)) {
      await chat.replyToCurrentPerson(
        `Kamu tidak memiliki kartu ${choosenCard}!`,
      );
    } else {
      await card.solve(choosenCard as allCard);
    }
  } else {
    await chat.replyToCurrentPerson("Bukan giliranmu saat ini!");
  }
});
