import type { User } from "../handler/database";
import { normalizePhoneNumber } from "./phone";

export const normalizePlayerName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");

/**
 * Finds players by exact phone number or by a case-insensitive partial name.
 * A partial name is intentional so "basuki" and even "uki" can match
 * "Muhammad basuki".
 */
export const findPlayersByIdentifier = (
  players: Array<User | null>,
  identifier: string,
) => {
  const query = identifier.trim();
  if (!query) return [];

  const normalizedQuery = normalizePlayerName(query);
  const normalizedPhone = normalizePhoneNumber(query);

  return players.filter((player): player is User => {
    if (!player) return false;

    return (
      normalizePhoneNumber(player.phoneNumber) === normalizedPhone ||
      normalizePlayerName(player.username).includes(normalizedQuery)
    );
  });
};

export const formatPlayerMatches = (players: User[]) =>
  players.map((player) => `${player.username} (${player.phoneNumber})`).join(", ");