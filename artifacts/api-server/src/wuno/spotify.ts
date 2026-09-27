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
export const SPOTIFY_AUDIO_CHUNK_BYTES = 192 * 1024;

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

  const contentType = String(
    response.headers.get("content-type") || "",
  ).split(";")[0].trim().toLowerCase();
  const buffer = Buffer.from(await response.arrayBuffer());
  const header = buffer.subarray(0, 64).toString("latin1");

  if (!buffer.length) {
    throw new Error("Audio kosong");
  }
  if (
    /^(text\/html|application\/json|text\/plain)$/i.test(contentType) ||
    /^\s*(<!doctype|<html|\{)/i.test(header)
  ) {
    throw new Error("Sumber audio mengembalikan halaman error");
  }

  return {
    buffer,
    mime:
      contentType &&
      contentType !== "application/octet-stream" &&
      contentType !== "binary/octet-stream"
        ? contentType
        : "audio/mpeg",
  };
}

async function y2mateGetMp3Url(videoId: string): Promise<string> {
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
  let downloadUrl = "";

  for (let i = 0; i < 20; i++) {
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
      downloadUrl = String(data.downloadURL);
      break;
    }

    if (data?.progressURL) progressUrl = String(data.progressURL);

    if (data?.redirectURL) {
      convertUrl = String(data.redirectURL);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }

    break;
  }

  if (!downloadUrl && progressUrl) {
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const data = await requestJson(progressUrl, { headers }, 20000);

      if (data?.downloadURL) {
        downloadUrl = String(data.downloadURL);
        break;
      }

      if (data?.redirectURL) {
        const redirect = await requestJson(
          String(data.redirectURL),
          { headers },
          20000,
        );

        if (redirect?.downloadURL) {
          downloadUrl = String(redirect.downloadURL);
          break;
        }

        if (redirect?.progressURL) {
          progressUrl = String(redirect.progressURL);
        }
      }
    }
  }

  if (!downloadUrl) throw new Error("y2mate audio tidak tersedia");

  return downloadUrl + "&v=" + encodeURIComponent(videoId) + "&f=mp3&r=y2mate.gs";
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

async function fallbackAudioUrl(videoId: string): Promise<string> {
  const videoUrl = "https://www.youtube.com/watch?v=" + videoId;
  const errors: string[] = [];

  console.info("[SPOTIFY-FALLBACK-URL] START", { videoId });

  try {
    const data = await requestJson(
      "https://ytdlpyton.nvlgroup.my.id/download/audio?url=" +
        encodeURIComponent(videoUrl) +
        "&mode=url",
      {},
      45000,
    );
    if (!data?.download_url) throw new Error("YTDLPyton URL kosong");
    console.info("[SPOTIFY-FALLBACK-URL] YTDLPYTON OK", { videoId, url: String(data.download_url) });
    return String(data.download_url);
  } catch (error) {
    errors.push("YTDLPyton: " + (error instanceof Error ? error.message : String(error)));
  }

  try {
    const data = await requestJson(
      "https://api.nekolabs.my.id/downloader/youtube/v1?url=" +
        encodeURIComponent(videoUrl) +
        "&format=mp3",
      {},
      45000,
    );
    const url = data?.result?.downloadUrl;
    if (!data?.success || !url) throw new Error("NekoLabs URL kosong");
    console.info("[SPOTIFY-FALLBACK-URL] NEKOLABS OK", { videoId, url: String(url) });
    return String(url);
  } catch (error) {
    errors.push("NekoLabs: " + (error instanceof Error ? error.message : String(error)));
  }

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
          Origin: "https://p.savenow.to/",
        },
      },
      30000,
    );

    if (!init?.success || !init?.progress_url) {
      throw new Error("SaveNow gagal memulai");
    }

    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const result = await requestJson(String(init.progress_url), {}, 30000);
      if (result?.success === -1) throw new Error("SaveNow gagal");
      if (result?.download_url) {
        console.info("[SPOTIFY-FALLBACK-URL] SAVENOW OK", { videoId, url: String(result.download_url) });
        return String(result.download_url);
      }
    }

    throw new Error("SaveNow timeout");
  } catch (error) {
    errors.push("SaveNow: " + (error instanceof Error ? error.message : String(error)));
  }

  console.error("[SPOTIFY-FALLBACK-URL] FAILED", { videoId, errors });
  throw new Error("Fallback audio URL gagal: " + errors.join(" | "));
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

export async function getSpotifyRichMedia(id: string): Promise<{
  track: Track;
  audioUrl: string;
  audioDataUrl: string;
  coverDataUrl: string | null;
}> {
  const resolved = await resolveSpotifyHtmlAudio(id);

  console.info("[SPOTIFY-RICH-MEDIA] AUDIO FETCH", {
    id: String(id),
    host: (() => {
      try { return new URL(resolved.audioUrl).host; } catch { return "INVALID_URL"; }
    })(),
    urlLength: resolved.audioUrl.length,
  });

  const audio = await downloadBinary(resolved.audioUrl, "https://spotsaver.net/");
  const audioDataUrl =
    "data:" + (audio.mime || "audio/mpeg") + ";base64," +
    audio.buffer.toString("base64");

  let coverDataUrl: string | null = null;

  if (resolved.track.thumbnail) {
    try {
      console.info("[SPOTIFY-RICH-MEDIA] COVER FETCH", {
        id: String(id),
        host: (() => {
          try { return new URL(resolved.track.thumbnail!).host; } catch { return "INVALID_URL"; }
        })(),
      });

      const coverResponse = await fetch(resolved.track.thumbnail, {
        headers: {
          "User-Agent": UA,
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          Referer: "https://open.spotify.com/",
        },
      });

      if (coverResponse.ok) {
        const coverBuffer = Buffer.from(await coverResponse.arrayBuffer());
        const coverMime = String(
          coverResponse.headers.get("content-type") || "image/jpeg",
        ).split(";")[0];

        coverDataUrl =
          "data:" + coverMime + ";base64;" +
          coverBuffer.toString("base64");

        // Correct the separator if the content type was followed by ';base64;'.
        coverDataUrl =
          "data:" + coverMime + ";base64," + coverBuffer.toString("base64");

        console.info("[SPOTIFY-RICH-MEDIA] COVER READY", {
          id: String(id),
          bytes: coverBuffer.length,
          mime: coverMime,
        });
      } else {
        console.warn("[SPOTIFY-RICH-MEDIA] COVER HTTP", {
          id: String(id),
          status: coverResponse.status,
        });
      }
    } catch (error) {
      console.warn("[SPOTIFY-RICH-MEDIA] COVER FAILED", {
        id: String(id),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info("[SPOTIFY-RICH-MEDIA] AUDIO READY", {
    id: String(id),
    bytes: audio.buffer.length,
    mime: audio.mime,
    dataUrlLength: audioDataUrl.length,
    coverEmbedded: Boolean(coverDataUrl),
  });

  return {
    track: resolved.track,
    audioUrl: resolved.audioUrl,
    audioDataUrl,
    coverDataUrl,
  };
}

export async function getSpotifyAudio(
  token: string,
  index: number,
): Promise<{ track: Track; buffer: Buffer; mime: string }> {
  return getAudio(token, index);
}

const spotifyAudioCache = new Map<string, { buffer: Buffer; mime: string; createdAt: number }>();

const spotifyHtmlAudioCache = new Map<string, { url: string; createdAt: number }>();

export async function resolveSpotifyHtmlAudio(id: string): Promise<{
  track: Track;
  audioUrl: string;
}> {
  const track = getSpotifyTrackById(id);
  const cached = spotifyHtmlAudioCache.get(String(id));

  console.info("[SPOTIFY-RESOLVE] START", {
    id: String(id),
    title: track.title,
    artist: track.artist,
    hasPreview: Boolean(track.previewUrl),
  });

  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
    console.info("[SPOTIFY-RESOLVE] CACHE HIT", {
      id: String(id),
      host: (() => {
        try { return new URL(cached.url).host; } catch { return "INVALID_URL"; }
      })(),
    });
    return { track, audioUrl: cached.url };
  }

  // Ikuti pola HIROBOT untuk mendapatkan audio penuh.
  try {
    console.info("[SPOTIFY-RESOLVE] YTM SEARCH", {
      id: String(id),
      query: track.title + " " + track.artist,
    });

    const results = await ytmSearch(track.title + " " + track.artist);
    console.info("[SPOTIFY-RESOLVE] YTM RESULT", {
      id: String(id),
      count: results.length,
      first: results[0] || null,
    });

    if (results.length) {
      try {
        const audioUrl = await y2mateGetMp3Url(results[0].videoId);
        spotifyHtmlAudioCache.set(String(id), {
          url: audioUrl,
          createdAt: Date.now(),
        });
        console.info("[SPOTIFY-RESOLVE] Y2MATE OK", {
          id: String(id),
          videoId: results[0].videoId,
          host: (() => {
            try { return new URL(audioUrl).host; } catch { return "INVALID_URL"; }
          })(),
        });
        return { track, audioUrl };
      } catch (error) {
        console.warn("[SPOTIFY-RESOLVE] Y2MATE FAILED", {
          id: String(id),
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const audioUrl = await fallbackAudioUrl(results[0].videoId);
        spotifyHtmlAudioCache.set(String(id), {
          url: audioUrl,
          createdAt: Date.now(),
        });
        console.info("[SPOTIFY-RESOLVE] FALLBACK URL OK", {
          id: String(id),
          host: (() => {
            try { return new URL(audioUrl).host; } catch { return "INVALID_URL"; }
          })(),
        });
        return { track, audioUrl };
      } catch (error) {
        console.warn("[SPOTIFY-RESOLVE] FALLBACK URL FAILED", {
          id: String(id),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    console.warn("[SPOTIFY-RESOLVE] YTM FAILED", {
      id: String(id),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Preview hanya fallback terakhir; jangan download dari server karena CDN
  // preview dapat menolak request server dengan HTTP 403.
  if (track.previewUrl) {
    console.warn("[SPOTIFY-RESOLVE] USING PREVIEW LAST RESORT", {
      id: String(id),
      host: (() => {
        try { return new URL(track.previewUrl!).host; } catch { return "INVALID_URL"; }
      })(),
    });
    return { track, audioUrl: track.previewUrl };
  }

  throw new Error("Audio lagu tidak tersedia.");
}

function loggerSafeSpotify(message: string, error: unknown) {
  // Helper kecil agar modul Spotify tidak bergantung pada logger HTTP.
  console.error("[SPOTIFY]", message, error instanceof Error ? error.message : error);
}

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


export async function getSpotifyAudioMetaById(id: string): Promise<{
  track: Track;
  size: number;
  total: number;
  mime: string;
}> {
  const audio = await getSpotifyAudioById(id);
  return {
    track: audio.track,
    size: audio.buffer.length,
    total: Math.ceil(audio.buffer.length / SPOTIFY_AUDIO_CHUNK_BYTES),
    mime: audio.mime || "audio/mpeg",
  };
}

export async function getSpotifyAudioChunkById(
  id: string,
  chunkNumber: number,
): Promise<{
  track: Track;
  n: number;
  total: number;
  mime: string;
  data: string;
}> {
  if (!Number.isInteger(chunkNumber) || chunkNumber < 0) {
    throw new Error("Nomor chunk audio tidak valid");
  }

  const audio = await getSpotifyAudioById(id);
  const total = Math.ceil(audio.buffer.length / SPOTIFY_AUDIO_CHUNK_BYTES);
  if (chunkNumber >= total) {
    throw new Error("Chunk audio di luar batas");
  }

  const start = chunkNumber * SPOTIFY_AUDIO_CHUNK_BYTES;
  const part = audio.buffer.subarray(start, start + SPOTIFY_AUDIO_CHUNK_BYTES);
  return {
    track: audio.track,
    n: chunkNumber,
    total,
    mime: audio.mime || "audio/mpeg",
    data: part.toString("base64"),
  };
}

export async function getSpotifyCoverDataById(
  id: string,
): Promise<string | null> {
  const track = getSpotifyTrackById(id);
  if (!track.thumbnail) return null;

  const response = await fetch(track.thumbnail, {
    headers: {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      Referer: "https://open.spotify.com/",
    },
  });
  if (!response.ok) throw new Error("Cover HTTP " + response.status);

  const buffer = Buffer.from(await response.arrayBuffer());
  const mime = String(
    response.headers.get("content-type") || "image/jpeg",
  ).split(";")[0];
  return `data:${mime};base64,${buffer.toString("base64")}`;
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
