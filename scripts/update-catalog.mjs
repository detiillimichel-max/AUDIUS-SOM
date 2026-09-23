import fs from "node:fs/promises";
import { sdk } from "@audius/sdk";

const API_KEY = process.env.AUDIUS_API_KEY;
const CATALOG_PATH = "data/catalogo.json";
const TTL_MS = 8 * 60 * 60 * 1000;
const LIMIT = 100;
const PAUSE_MS = 200;

if (!API_KEY) {
  throw new Error("AUDIUS_API_KEY não configurado.");
}

const audius = sdk({ apiKey: API_KEY });

const blockDefinitions = [
  ["trending", () => audius.tracks.getTrendingTracks({ limit: LIMIT, time: "allTime" })],
  ["underground", () => audius.tracks.getUndergroundTrendingTracks({ limit: LIMIT })],
  ["latest", () => audius.tracks.searchTracks({ limit: LIMIT, sortMethod: "recent" })],
  ["electronic", () => audius.tracks.getTrendingTracks({ limit: LIMIT, genre: "Electronic", time: "week" })],
  ["hiphop", () => audius.tracks.getTrendingTracks({ limit: LIMIT, genre: "Hip-Hop/Rap", time: "week" })],
  ["pop", () => audius.tracks.getTrendingTracks({ limit: LIMIT, genre: "Pop", time: "week" })],
  ["rock", () => audius.tracks.getTrendingTracks({ limit: LIMIT, genre: "Rock", time: "week" })],
  ["ambient", () => audius.tracks.getTrendingTracks({ limit: LIMIT, genre: "Ambient", time: "week" })],
  ["house", () => audius.tracks.getTrendingTracks({ limit: LIMIT, genre: "House", time: "week" })],
  ["discoveries", () => audius.tracks.getTrendingTracks({ limit: LIMIT, offset: LIMIT, time: "week" })]
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
    ttlHours: 8,
    blocks: {}
  };
}

catalog.schemaVersion = 1;
catalog.ttlHours = 8;
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
    const tracks = validTracks(response.data ?? []).slice(0, LIMIT);

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
