import {
  getCatalogBlocks,
  saveCatalog
} from "./indexeddb.js";

const DEFAULT_CATALOG_URL = new URL(
  "data/catalogo.json",
  document.baseURI
).href;

function normalizeRemoteCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || !catalog.blocks) {
    throw new Error("Catálogo remoto inválido.");
  }

  const blocks = {};

  for (const [blockId, block] of Object.entries(catalog.blocks)) {
    if (!block || typeof block !== "object") continue;

    const tracks = Array.isArray(block.tracks) ? block.tracks : [];

    // Nunca substitui um bloco local por um bloco remoto vazio.
    if (!tracks.length) continue;

    blocks[blockId] = {
      label: block.label ?? blockId,
      updatedAt: block.updatedAt ?? null,
      tracks
    };
  }

  return {
    schemaVersion: catalog.schemaVersion ?? 1,
    generatedAt: catalog.generatedAt ?? null,
    ttlDays: catalog.ttlDays ?? 7,
    blocks
  };
}

function blockChanged(localBlock, remoteBlock) {
  if (!localBlock) return true;

  if (localBlock.updatedAt !== remoteBlock.updatedAt) return true;

  if ((localBlock.tracks?.length ?? 0) !== (remoteBlock.tracks?.length ?? 0)) {
    return true;
  }

  return false;
}

export async function syncCatalog(options = {}) {
  const catalogUrl = options.url ?? DEFAULT_CATALOG_URL;
  const localBlocks = await getCatalogBlocks();

  const localById = new Map(
    localBlocks.map((block) => [block.blockId, block])
  );

  try {
    const response = await fetch(catalogUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Catálogo remoto HTTP ${response.status}.`);
    }

    const remote = normalizeRemoteCatalog(await response.json());
    const changedBlocks = {};

    for (const [blockId, remoteBlock] of Object.entries(remote.blocks)) {
      if (blockChanged(localById.get(blockId), remoteBlock)) {
        changedBlocks[blockId] = remoteBlock;
      }
    }

    if (Object.keys(changedBlocks).length) {
      await saveCatalog({ blocks: changedBlocks });
    }

    const blocks = await getCatalogBlocks();

    return {
      source: "remote",
      remoteAvailable: true,
      isStale: false,
      generatedAt: remote.generatedAt,
      ttlDays: remote.ttlDays,
      updatedBlocks: Object.keys(changedBlocks),
      blocks
    };
  } catch (error) {
    return {
      source: "local-fallback",
      remoteAvailable: false,
      isStale: localBlocks.length > 0,
      generatedAt: null,
      ttlDays: 7,
      updatedBlocks: [],
      blocks: localBlocks,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function loadCatalog(options = {}) {
  const result = await syncCatalog(options);

  if (!result.blocks.length && result.source === "local-fallback") {
    throw new Error(
      `Não foi possível carregar o catálogo remoto e não existe catálogo local. ${result.error}`
    );
  }

  return result;
}
