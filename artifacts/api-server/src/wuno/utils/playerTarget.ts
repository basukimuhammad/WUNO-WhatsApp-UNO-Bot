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

/**
 * Resolves a target at the beginning of a command such as:
 * `sayto Muhammad basuki halo`.
 *
 * Names may contain spaces, so every leading group of arguments is tried as
 * the identifier. The longest matching group wins.
 */
export const findPlayerTargetFromArgs = (
  players: Array<User | null>,
  args: string[],
) => {
  let fallback:
    | {
        identifier: string;
        matches: User[];
        message: string;
      }
    | undefined;

  for (let length = args.length; length > 0; length -= 1) {
    const identifier = args
      .slice(0, length)
      .join(" ")
      .replace(/^@/, "")
      .trim();
    const matches = findPlayersByIdentifier(players, identifier);

    if (matches.length === 0) continue;

    const result = {
      identifier,
      matches,
      message: args.slice(length).join(" ").trim(),
    };

    if (matches.length === 1) return result;
    fallback ??= result;
  }

  return (
    fallback ?? {
      identifier: args[0]?.replace(/^@/, "").trim() ?? "",
      matches: [],
      message: args.slice(1).join(" ").trim(),
    }
  );
};
