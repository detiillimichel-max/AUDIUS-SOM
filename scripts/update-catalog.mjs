import fs from "node:fs/promises";

const API_KEY = process.env.AUDIUS_API_KEY;
const API_BASE = "https://api.audius.co/v1";
const CATALOG_PATH = "data/catalogo.json";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 100;
const PAUSE_MS = 200;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

if (!API_KEY) {
  throw new Error("AUDIUS_API_KEY não configurado.");
}

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries({ ...params, api_key: API_KEY })) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function request(path, params = {}) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = buildUrl(path, params);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      });

      const text = await response.text();
      let payload;

      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const detail = payload?.error ?? payload?.message ?? text.slice(0, 200);
        throw new Error(`HTTP ${response.status}: ${detail}`);
      }

      if (!payload || !Array.isArray(payload.data)) {
        throw new Error("Resposta da Audius sem o campo data esperado.");
      }

      return payload;
    } catch (error) {
      lastError = error;
      const message = error?.name === "AbortError"
        ? `timeout após ${REQUEST_TIMEOUT_MS / 1000}s`
        : (error?.message ?? String(error));

      console.error(`[HTTP] tentativa ${attempt}/${MAX_ATTEMPTS}: ${message}`);

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

const blockDefinitions = [
  ["trending", () => request("/tracks/trending", { limit: LIMIT, time: "allTime" })],
  ["underground", () => request("/tracks/trending/underground", { limit: LIMIT })],
  ["latest", () => request("/tracks/search", { limit: LIMIT, sort_method: "recent" })],
  ["electronic", () => request("/tracks/trending", { limit: LIMIT, genre: "Electronic", time: "week" })],
  ["hiphop", () => request("/tracks/trending", { limit: LIMIT, genre: "Hip-Hop/Rap", time: "week" })],
  ["pop", () => request("/tracks/trending", { limit: LIMIT, genre: "Pop", time: "week" })],
  ["rock", () => request("/tracks/trending", { limit: LIMIT, genre: "Rock", time: "week" })],
  ["ambient", () => request("/tracks/trending", { limit: LIMIT, genre: "Ambient", time: "week" })],
  ["house", () => request("/tracks/trending", { limit: LIMIT, genre: "House", time: "week" })],
  ["discoveries", () => request("/tracks/trending", { limit: LIMIT, offset: LIMIT, time: "week" })]
];

function normalizeTrack(track) {
  return {
    id: track.id,
    title: track.title ?? "",
    artist: track.user?.name ?? track.user?.handle ?? "Artista Audius",
    handle: track.user?.handle ?? null,
    artwork: track.artwork?._480x480 ?? track.artwork?._1000x1000 ?? track.artwork?._150x150 ?? null,
    duration: Number(track.duration ?? 0),
    genre: track.genre ?? null,
    mood: track.mood ?? null,
    permalink: track.permalink ?? null,
    isStreamable: Boolean(track.isStreamable),
    playCount: Number(track.playCount ?? 0)
  };
}

function validTracks(data) {
  return data
    .filter((track) => track?.id && track?.isStreamable !== false)
    .map(normalizeTrack)
    .filter((track) => track.id);
}

let catalog;
try {
  catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
} catch {
  catalog = {
    schemaVersion: 1,
    generatedAt: null,
    ttlDays: 7,
    blocks: {}
  };
}

catalog.schemaVersion = 1;
catalog.ttlDays = 7;
catalog.blocks ??= {};

const now = Date.now();
let changed = false;
let refreshed = 0;

for (const [name, fetcher] of blockDefinitions) {
  const current = catalog.blocks[name] ?? {
    label: name,
    updatedAt: null,
    tracks: []
  };

  const updatedMs = current.updatedAt ? Date.parse(current.updatedAt) : 0;
  const expired = !updatedMs || now - updatedMs >= TTL_MS;

  if (!expired && current.tracks?.length) {
    console.log(`[CACHE] ${name}: válido, mantendo ${current.tracks.length} músicas.`);
    catalog.blocks[name] = current;
    continue;
  }

  console.log(`[AUDIUS] ${name}: renovando bloco...`);

  try {
    const response = await fetcher();
    const tracks = validTracks(response.data).slice(0, LIMIT);

    if (!tracks.length) {
      throw new Error("Audius retornou 0 faixas válidas.");
    }

    catalog.blocks[name] = {
      ...current,
      updatedAt: new Date().toISOString(),
      tracks
    };

    refreshed++;
    changed = true;
    console.log(`[OK] ${name}: ${tracks.length} músicas.`);
  } catch (error) {
    console.error(`[ERRO] ${name}:`, error?.message ?? error);
    console.log(`[FALLBACK] ${name}: mantendo o bloco anterior.`);
  }

  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

if (refreshed > 0) {
  catalog.generatedAt = new Date().toISOString();
  changed = true;
}

await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");

const total = Object.values(catalog.blocks)
  .reduce((sum, block) => sum + (block.tracks?.length ?? 0), 0);

console.log(`[RESUMO] Blocos renovados: ${refreshed}; músicas catalogadas: ${total}.`);

if (!changed) {
  console.log("[INFO] Nenhum bloco precisava de atualização.");
}
