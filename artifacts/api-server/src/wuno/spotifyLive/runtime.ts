import type { WebSocket } from "ws";

export interface SpotifyLiveTrack {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
}

export interface SpotifyLiveMember {
  id: string;
  name: string;
  ws?: WebSocket;
  lastSeen: number;
}

export interface SpotifyLiveRoom {
  code: string;
  ownerChatId: string;
  hostId: string | null;
  ownerPlayerId: string;
  members: Map<string, SpotifyLiveMember>;
  current: SpotifyLiveTrack | null;
  isPlaying: boolean;
  position: number;
  updatedAt: number;
  createdAt: number;
  chat: Array<{ id: string; name: string; text: string; at: number }>;
}

const rooms = new Map<string, SpotifyLiveRoom>();
const roomByChat = new Map<string, string>();

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function createOrGetSpotifyLiveRoom(
  ownerChatId: string,
  ownerPlayerId = "",
) {
  const oldCode = roomByChat.get(ownerChatId);
  if (oldCode) {
    const old = rooms.get(oldCode);
    if (old) return old;
    roomByChat.delete(ownerChatId);
  }

  let code = makeCode();
  while (rooms.has(code)) code = makeCode();

  const room: SpotifyLiveRoom = {
    code,
    ownerChatId,
    hostId: ownerPlayerId || null,
    ownerPlayerId,
    members: new Map(),
    current: null,
    isPlaying: false,
    position: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    chat: [],
  };

  rooms.set(code, room);
  roomByChat.set(ownerChatId, code);
  return room;
}

export function getOrCreateSpotifyLiveRoom(ownerChatId: string, ownerPlayerId = "") {
  return createOrGetSpotifyLiveRoom(ownerChatId, ownerPlayerId);
}

export function getSpotifyLiveRoom(code: string) {
  return rooms.get(code.trim().toUpperCase());
}

function pruneMembers(room: SpotifyLiveRoom) {
  const cutoff = Date.now() - 45_000;
  for (const [id, member] of room.members) {
    if (member.lastSeen < cutoff) room.members.delete(id);
  }
  if (room.hostId && !room.members.has(room.hostId)) {
    room.hostId = room.members.keys().next().value ?? null;
  }
}

export function touchSpotifyLiveMember(
  room: SpotifyLiveRoom,
  memberId: string,
  name?: string,
) {
  const existing = room.members.get(memberId);
  if (existing) {
    existing.lastSeen = Date.now();
    if (name?.trim()) existing.name = name.trim().slice(0, 60);
    return existing;
  }

  const member: SpotifyLiveMember = {
    id: memberId,
    name: name?.trim().slice(0, 60) || "Pendengar",
    lastSeen: Date.now(),
  };
  room.members.set(memberId, member);
  if (!room.hostId) room.hostId = memberId;
  return member;
}

export function roomState(room: SpotifyLiveRoom, me?: string, message?: string) {
  pruneMembers(room);
  return {
    game: "spotifylive",
    room: room.code,
    current: room.current,
    isPlaying: room.isPlaying,
    position:
      room.position +
      (room.isPlaying ? Math.max(0, (Date.now() - room.updatedAt) / 1000) : 0),
    updatedAt: room.updatedAt,
    listenerCount: room.members.size,
    members: Array.from(room.members.values()).map((member) => ({
      id: member.id,
      name: member.name,
      isHost: member.id === room.hostId,
    })),
    isHost: me ? room.hostId === me : false,
    message: message ?? "",
    chat: room.chat.slice(-30),
  };
}

export function sendSpotifyLive(member: SpotifyLiveMember, payload: unknown) {
  if (member.ws.readyState === 1) {
    member.ws.send(JSON.stringify(payload));
  }
}

export function broadcastSpotifyLive(room: SpotifyLiveRoom, message = "") {
  for (const member of room.members.values()) {
    sendSpotifyLive(member, roomState(room, member.id, message));
  }
}

export function joinSpotifyLiveRoom(
  room: SpotifyLiveRoom,
  member: SpotifyLiveMember,
) {
  member.lastSeen = Date.now();
  room.members.set(member.id, member);

  if (!room.hostId) {
    room.hostId = member.id;
  }

  broadcastSpotifyLive(
    room,
    room.members.size === 1
      ? "Kamu adalah host. Tunggu teman masuk ke room."
      : "Room siap. Dengerin bareng!",
  );
}

export function leaveSpotifyLiveRoom(room: SpotifyLiveRoom, memberId: string) {
  room.members.delete(memberId);

  if (room.hostId === memberId) {
    const next = room.members.values().next().value as SpotifyLiveMember | undefined;
    room.hostId = next?.id ?? null;
  }

  if (room.members.size === 0) {
    rooms.delete(room.code);
    if (roomByChat.get(room.ownerChatId) === room.code) {
      roomByChat.delete(room.ownerChatId);
    }
    return;
  }

  broadcastSpotifyLive(
    room,
    room.hostId
      ? "Host berpindah ke pemain lain."
      : "Host belum tersedia.",
  );
}

export function spotifyLiveRoomIsHost(room: SpotifyLiveRoom, memberId: string) {
  return room.hostId === memberId;
}

export function addSpotifyLiveChat(
  room: SpotifyLiveRoom,
  memberId: string,
  text: string,
) {
  const member = room.members.get(memberId);
  if (!member) return;
  const clean = text.trim().slice(0, 300);
  if (!clean) return;
  room.chat.push({
    id: crypto.randomUUID(),
    name: member.name,
    text: clean,
    at: Date.now(),
  });
  if (room.chat.length > 50) room.chat.splice(0, room.chat.length - 50);
  room.updatedAt = Date.now();
}

export function setSpotifyLiveTrack(
  room: SpotifyLiveRoom,
  track: SpotifyLiveTrack,
) {
  room.current = track;
  room.isPlaying = true;
  room.position = 0;
  room.updatedAt = Date.now();
  broadcastSpotifyLive(room, `Sekarang diputar: ${track.title}`);
}

export function toggleSpotifyLive(
  room: SpotifyLiveRoom,
  isPlaying: boolean,
  position: number,
) {
  room.isPlaying = isPlaying;
  room.position = Number.isFinite(position) && position >= 0 ? position : 0;
  room.updatedAt = Date.now();
  broadcastSpotifyLive(room, isPlaying ? "Musik diputar." : "Musik dijeda.");
}

export function syncSpotifyLive(room: SpotifyLiveRoom, position: number) {
  room.position = Number.isFinite(position) && position >= 0 ? position : 0;
  room.updatedAt = Date.now();

  for (const member of room.members.values()) {
    if (member.id !== room.hostId) {
      sendSpotifyLive(member, {
        type: "sync",
        position: room.position,
        updatedAt: room.updatedAt,
      });
    }
  }
}
