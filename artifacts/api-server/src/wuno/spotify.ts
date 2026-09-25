import { randomBytes } from "node:crypto";
import { MessageMedia, type Client } from "whatsapp-web.js";

const BASE = "https://spotsaver.net";
const YTM_API = "https://music.youtube.com/youtubei/v1/search";
const YTM_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const YTM_VERSION = "1.20260915.14.00";
const Y2MATE_API = "https://eta.etacloud.org";
const Y2MATE_KEY = "c6a644f406b57d0dd83837c868a7482e";
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36";
const SESSION_TTL = 15 * 60 * 1000;

type Track = {
  id: string | null;
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbnail: string | null;
  spotifyUrl: string | null;
  previewUrl: string | null;
  audioUrl?: string | null;
};

type Session = {
  client: Client;
  chatId: string;
  createdAt: number;
  tracks: Track[];
  audioBuffers: Map<number, Buffer>;
  audioMimes: Map<number, string>;
};

const sessions = new Map<string, Session>();
const spotifyTrackCache = new Map<string, Track>();

async function requestJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 45000,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
        ...(init.headers || {}),
      },
    });

    const text = await response.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}` +
          (typeof data === "string" && data ? `: ${data.slice(0, 180)}` : ""),
      );
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTrack(value: any): Track {
  return {
    id: value?.id ?? null,
    title: value?.title || "Unknown Title",
    artist: value?.artist || "Unknown Artist",
    album: value?.album || "Unknown Album",
    duration: value?.duration || "0:00",
    thumbnail: value?.thumbnail || null,
    spotifyUrl: value?.id
      ? "https://open.spotify.com/track/" + value.id
      : null,
    previewUrl:
      value?.previewUrl ||
      value?.preview_url ||
      value?.audio ||
      value?.audioUrl ||
      value?.download_url ||
      null,
    audioUrl: null,
  };
}

async function searchSpotify(q: string): Promise<Track[]> {
  const data = await requestJson(
    BASE + "/api/spotify?q=" + encodeURIComponent(q),
    {},
    20000,
  );

  if (!data?.items) {
    throw new Error("SpotSaver tidak mengembalikan hasil");
  }

  const tracks = data.items
    .map(normalizeTrack)
    .filter((track: Track) => track.title && track.id)
    .slice(0, 12);

  for (const track of tracks) {
    spotifyTrackCache.set(String(track.id), track);
  }

  return tracks;
}

async function infoSpotify(url: string): Promise<Track[]> {
  const data = await requestJson(
    BASE + "/api/spotify?url=" + encodeURIComponent(url),
    {},
    30000,
  );

  if (!data?.items) {
    throw new Error("Info Spotify gagal");
  }

  const tracks = data.items.map(normalizeTrack).filter((track: Track) => track.id);
  for (const track of tracks) {
    spotifyTrackCache.set(String(track.id), track);
  }
  return tracks;
}

async function ytmSearch(query: string): Promise<Array<{ videoId: string; title: string; subtitle: string }>> {
  const body = {
    context: {
      client: {
        clientName: "WEB_REMIX",
        clientVersion: YTM_VERSION,
        hl: "id",
        gl: "ID",
      },
    },
    query,
    params: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
  };

  const data = await requestJson(
    YTM_API + "?key=" + YTM_KEY + "&prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": YTM_KEY,
        "X-YouTube-Client-Name": "67",
        "X-YouTube-Client-Version": YTM_VERSION,
        Origin: "https://music.youtube.com",
        Referer: "https://music.youtube.com/",
      },
      body: JSON.stringify(body),
    },
    30000,
  );

  const results: Array<{ videoId: string; title: string; subtitle: string }> = [];

  for (const tab of data?.contents?.tabbedSearchResultsRenderer?.tabs || []) {
    for (const section of tab?.tabRenderer?.content?.sectionListRenderer?.contents || []) {
      for (const item of section?.musicShelfRenderer?.contents || []) {
        const renderer = item?.musicResponsiveListItemRenderer;
        if (!renderer) continue;

        const videoId = renderer?.playlistItemData?.videoId;
        const texts = (renderer.flexColumns || [])
          .map((column: any) =>
            (column?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [])
              .map((run: any) => run.text)
              .join("")
              .trim(),
          )
          .filter(Boolean);

        if (videoId && texts[0]) {
          results.push({
            videoId,
            title: texts[0],
            subtitle: texts[1] || "",
          });
        }
      }
    }
  }

  return results;
}

async function downloadBinary(
  url: string,
  referer: string,
): Promise<{ buffer: Buffer; mime: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
      Referer: referer,
    },
  });

  if (!response.ok) {
    throw new Error("Audio HTTP " + response.status);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mime: String(
      response.headers.get("content-type") || "audio/mpeg",
    ).split(";")[0],
  };
}

async function y2mateGet(videoId: string): Promise<{ buffer: Buffer; mime: string }> {
  const headers = {
    "Origin": "https://y2mate.gs",
    "Referer": "https://y2mate.gs/",
    "Accept": "application/json, text/plain, */*",
    "User-Agent": UA,
  };

  const auth = await requestJson(
    Y2MATE_API + "/api/v1/auth?api_key=" + Y2MATE_KEY + "&_=" + Date.now(),
    { headers },
    20000,
  );

  if (!auth?.key) throw new Error("y2mate auth gagal");

  const init = await requestJson(
    Y2MATE_API + "/api/v1/init?_=" + Date.now(),
    {
      headers: {
        ...headers,
        Authorization: "Bearer " + auth.key,
      },
    },
    20000,
  );

  if (!init?.convertURL) throw new Error("y2mate init gagal");

  let convertUrl = String(init.convertURL);
  let progressUrl: string | null = null;

  for (let i = 0; i < 12; i++) {
    const url = new URL(convertUrl);
    url.searchParams.set("v", videoId);
    url.searchParams.set("f", "mp3");
    url.searchParams.set("_", String(Date.now()));

    const data = await requestJson(
      url.toString(),
      {
        headers: {
          ...headers,
          Authorization: "Bearer " + auth.key,
        },
      },
      20000,
    );

    if (data?.downloadURL) {
      return downloadBinary(String(data.downloadURL), "https://y2mate.gs/");
    }

    if (data?.progressURL) {
      progressUrl = String(data.progressURL);
    }

    if (data?.redirectURL) {
      convertUrl = String(data.redirectURL);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }

    break;
  }

  if (progressUrl) {
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const data = await requestJson(
        progressUrl,
        { headers },
        20000,
      );

      if (data?.downloadURL) {
        return downloadBinary(String(data.downloadURL), "https://y2mate.gs/");
      }

      if (data?.redirectURL) {
        const redirect = await requestJson(
          String(data.redirectURL),
          { headers },
          20000,
        );
        if (redirect?.downloadURL) {
          return downloadBinary(
            String(redirect.downloadURL),
            "https://y2mate.gs/",
          );
        }
        if (redirect?.progressURL) {
          progressUrl = String(redirect.progressURL);
        }
      }
    }
  }

  throw new Error("y2mate audio tidak tersedia");
}

async function fallbackDownloader(
  videoId: string,
): Promise<{ buffer: Buffer; mime: string }> {
  const videoUrl = "https://www.youtube.com/watch?v=" + videoId;
  const errors: string[] = [];

  const downloadUrl = async (
    url: string,
    referer: string,
    label: string,
  ) => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          Referer: referer,
        },
      });

      if (!response.ok) {
        throw new Error(label + " HTTP " + response.status);
      }

      const mime = String(
        response.headers.get("content-type") || "audio/mpeg",
      ).split(";")[0];

      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mime,
      };
    } catch (error) {
      throw new Error(
        label + ": " + (error instanceof Error ? error.message : String(error)),
      );
    }
  };

  // 1. ytdlpyton - audio langsung
  try {
    const data = await requestJson(
      "https://ytdlpyton.nvlgroup.my.id/download/audio?url=" +
        encodeURIComponent(videoUrl) +
        "&mode=url",
      {},
      45000,
    );

    if (!data?.download_url) throw new Error("URL audio kosong");

    return await downloadUrl(
      String(data.download_url),
      "https://ytdlpyton.nvlgroup.my.id/",
      "YTDLPyton",
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // 2. NekoLabs - MP3
  try {
    const data = await requestJson(
      "https://api.nekolabs.my.id/downloader/youtube/v1?url=" +
        encodeURIComponent(videoUrl) +
        "&format=mp3",
      {},
      45000,
    );

    if (!data?.success || !data?.result?.downloadUrl) {
      throw new Error("URL MP3 kosong");
    }

    return await downloadUrl(
      String(data.result.downloadUrl),
      "https://api.nekolabs.my.id/",
      "NekoLabs",
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // 3. SaveNow - MP3 dengan polling
  try {
    const api = "https://p.savenow.to";
    const key = "dfcb6d76f2f6a9894gjkege8a4ab232222";

    const init = await requestJson(
      api +
        "/ajax/download.php?copyright=0&format=mp3&url=" +
        encodeURIComponent(videoUrl) +
        "&api=" +
        encodeURIComponent(key),
      {
        headers: {
          Referer: "https://p.savenow.to/",
          Origin: "https://p.savenow.to",
        },
      },
      30000,
    );

    if (!init?.success || !init?.progress_url) {
      throw new Error("SaveNow gagal memulai download");
    }

    let finalUrl = "";
    for (let i = 0; i < 40; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const result = await requestJson(String(init.progress_url), {}, 30000);

      if (result?.success === -1) {
        throw new Error("SaveNow gagal memproses audio");
      }

      if (result?.download_url) {
        finalUrl = String(result.download_url);
        break;
      }
    }

    if (!finalUrl) throw new Error("SaveNow timeout");

    return await downloadUrl(
      finalUrl,
      "https://p.savenow.to/",
      "SaveNow",
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error("Downloader YouTube gagal: " + errors.join(" | "));
}

function getSession(token: string): Session {
  const session = sessions.get(token);

  if (
    !session ||
    Date.now() - session.createdAt > SESSION_TTL
  ) {
    if (session) sessions.delete(token);
    throw new Error("Sesi Spotify kedaluwarsa. Buka Spotify lagi.");
  }

  return session;
}

export function createSpotifySession(client: Client, chatId: string): string {
  const token = randomBytes(24).toString("hex");

  sessions.set(token, {
    client,
    chatId,
    createdAt: Date.now(),
    tracks: [],
    audioBuffers: new Map(),
    audioMimes: new Map(),
  });

  return token;
}

export async function spotifySearch(token: string, query: string): Promise<Track[]> {
  const session = getSession(token);
  const value = query.trim();

  if (!value) throw new Error("Query kosong");

  session.tracks = (
    /^https?:\/\/open\.spotify\.com\//i.test(value)
      ? await infoSpotify(value.split("?")[0])
      : await searchSpotify(value)
  ).slice(0, 12);

  return session.tracks.map(({ audioUrl, ...track }) => track);
}

export function getSpotifyTrackById(id: string): Track {
  const track = spotifyTrackCache.get(String(id));
  if (!track) throw new Error("Lagu tidak ditemukan di cache.");
  return track;
}

export function getSpotifyTrack(token: string, index: number): Track {
  const session = getSession(token);
  const track = session.tracks[index];

  if (!track) throw new Error("Track tidak ditemukan");

  return track;
}

export async function resolveSpotifyTrack(
  token: string,
  index: number,
): Promise<Track> {
  const session = getSession(token);
  const track = session.tracks[index];

  if (!track) throw new Error("Track tidak ditemukan");

  if (!track.audioUrl) {
    const results = await ytmSearch(track.title + " " + track.artist);

    if (!results.length) {
      throw new Error("Lagu tidak ditemukan di YouTube Music");
    }

    const videoId = results[0].videoId;

    try {
      const y2mate = await y2mateGet(videoId);
      // Simpan URL virtual untuk menandai bahwa file sudah diproses.
      // Buffer tetap di-cache pada audio().
      track.audioUrl = "cached-y2mate://" + videoId;
      session.audioBuffers.set(index, y2mate.buffer);
      session.audioMimes.set(index, y2mate.mime);
    } catch {
      track.audioUrl = "youtube://" + videoId;
    }
  }

  return track;
}

async function getAudio(
  token: string,
  index: number,
): Promise<{ track: Track; buffer: Buffer; mime: string }> {
  const session = getSession(token);

  const cached = session.audioBuffers.get(index);
  if (cached) {
    return {
      track: session.tracks[index]!,
      buffer: cached,
      mime: session.audioMimes.get(index) || "audio/mpeg",
    };
  }

  const track = await resolveSpotifyTrack(token, index);

  if (track.audioUrl?.startsWith("cached-y2mate://")) {
    const cachedBuffer = session.audioBuffers.get(index);
    if (!cachedBuffer) throw new Error("Audio cache tidak ditemukan");

    return {
      track,
      buffer: cachedBuffer,
      mime: session.audioMimes.get(index) || "audio/mpeg",
    };
  }

  const videoId = track.audioUrl?.startsWith("youtube://")
    ? track.audioUrl.slice("youtube://".length)
    : "";

  if (!videoId) throw new Error("Sumber audio tidak valid");

  const audio = await fallbackDownloader(videoId);
  session.audioBuffers.set(index, audio.buffer);
  session.audioMimes.set(index, audio.mime);

  return {
    track,
    buffer: audio.buffer,
    mime: audio.mime,
  };
}

export async function getSpotifyAudio(
  token: string,
  index: number,
): Promise<{ track: Track; buffer: Buffer; mime: string }> {
  return getAudio(token, index);
}
\nconst spotifyAudioCache = new Map<string, { buffer: Buffer; mime: string; createdAt: number }>();

export async function getSpotifyAudioById(
  id: string,
): Promise<{ track: Track; buffer: Buffer; mime: string }> {
  const track = getSpotifyTrackById(id);
  const cached = spotifyAudioCache.get(String(id));

  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
    return { track, buffer: cached.buffer, mime: cached.mime };
  }

  // SpotSaver preview adalah sumber pertama. Jika preview kosong/gagal,
  // gunakan resolver YouTube Music yang sudah dipakai fitur Spotify biasa.
  if (track.previewUrl) {
    try {
      const audio = await downloadBinary(track.previewUrl, BASE);
      spotifyAudioCache.set(String(id), { ...audio, createdAt: Date.now() });
      return { track, ...audio };
    } catch {
      // Lanjut ke fallback agar player tetap mendapatkan audio.
    }
  }

  const results = await ytmSearch(track.title + " " + track.artist);
  if (!results.length) {
    throw new Error("Audio Spotify tidak tersedia");
  }

  let audio: { buffer: Buffer; mime: string };
  try {
    audio = await y2mateGet(results[0].videoId);
  } catch {
    audio = await fallbackDownloader(results[0].videoId);
  }

  spotifyAudioCache.set(String(id), { ...audio, createdAt: Date.now() });
  return { track, ...audio };
}


export async function sendSpotifyTrack(
  token: string,
  index: number,
): Promise<{ title: string }> {
  const session = getSession(token);
  const { track, buffer, mime } = await getAudio(token, index);

  const extension = mime.includes("mp4") ? "m4a" : "mp3";
  const filename =
    track.title
      .replace(/[<>:"/\\|?*\\x00-\\x1F]/g, " ")
      .trim()
      .slice(0, 120) || "Spotify";

  const media = new MessageMedia(
    mime,
    buffer.toString("base64"),
    filename + "." + extension,
  );

  await session.client.sendMessage(session.chatId, media);
  return { title: track.title };
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;

  for (const [token, session] of sessions) {
    if (session.createdAt < cutoff) {
      sessions.delete(token);
    }
  }
}, 60000).unref();
