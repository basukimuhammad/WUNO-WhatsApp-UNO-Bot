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
  ws: WebSocket;
}

export interface SpotifyLiveRoom {
  code: string;
  ownerChatId: string;
  hostId: string | null;
  members: Map<string, SpotifyLiveMember>;
  current: SpotifyLiveTrack | null;
  isPlaying: boolean;
  position: number;
  updatedAt: number;
  createdAt: number;
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

export function createOrGetSpotifyLiveRoom(ownerChatId: string) {
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
    hostId: null,
    members: new Map(),
    current: null,
    isPlaying: false,
    position: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };

  rooms.set(code, room);
  roomByChat.set(ownerChatId, code);
  return room;
}

export function getOrCreateSpotifyLiveRoom(ownerChatId: string) { return createOrGetSpotifyLiveRoom(ownerChatId); }

export function getSpotifyLiveRoom(code: string) {
  return rooms.get(code.trim().toUpperCase());
}

export function roomState(room: SpotifyLiveRoom, me?: string, message?: string) {
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
    isHost: me ? room.hostId === me : false,
    message: message ?? "",
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
