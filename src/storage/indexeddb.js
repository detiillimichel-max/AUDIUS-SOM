const DB_NAME = "audius-som";
const DB_VERSION = 1;

const STORES = {
  CATALOG_BLOCKS: "catalog_blocks",
  FAVORITES: "favorites",
  PLAYLISTS: "playlists",
  HISTORY: "history",
  SETTINGS: "settings"
};

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function openAudiusDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB não está disponível neste navegador."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.CATALOG_BLOCKS)) {
        db.createObjectStore(STORES.CATALOG_BLOCKS, { keyPath: "blockId" });
      }

      if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
        db.createObjectStore(STORES.FAVORITES, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
        const store = db.createObjectStore(STORES.PLAYLISTS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }

      if (!db.objectStoreNames.contains(STORES.HISTORY)) {
        const store = db.createObjectStore(STORES.HISTORY, {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("playedAt", "playedAt");
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveCatalog(catalog) {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.CATALOG_BLOCKS, "readwrite");
  const store = transaction.objectStore(STORES.CATALOG_BLOCKS);

  for (const [blockId, block] of Object.entries(catalog?.blocks ?? {})) {
    store.put({
      blockId,
      label: block.label ?? blockId,
      updatedAt: block.updatedAt ?? null,
      tracks: Array.isArray(block.tracks) ? block.tracks : []
    });
  }

  await transactionToPromise(transaction);
  db.close();
}

export async function getCatalogBlocks() {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.CATALOG_BLOCKS, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(STORES.CATALOG_BLOCKS).getAll()
  );
  await transactionToPromise(transaction);
  db.close();
  return result;
}

export async function getCatalogBlock(blockId) {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.CATALOG_BLOCKS, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(STORES.CATALOG_BLOCKS).get(blockId)
  );
  await transactionToPromise(transaction);
  db.close();
  return result ?? null;
}

export async function addFavorite(track) {
  if (!track?.id) throw new Error("Faixa inválida para Favoritos.");

  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.FAVORITES, "readwrite");

  transaction.objectStore(STORES.FAVORITES).put({
    ...track,
    savedAt: new Date().toISOString()
  });

  await transactionToPromise(transaction);
  db.close();
}

export async function removeFavorite(trackId) {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.FAVORITES, "readwrite");
  transaction.objectStore(STORES.FAVORITES).delete(trackId);
  await transactionToPromise(transaction);
  db.close();
}

export async function getFavorites() {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.FAVORITES, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(STORES.FAVORITES).getAll()
  );
  await transactionToPromise(transaction);
  db.close();
  return result;
}

export async function isFavorite(trackId) {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.FAVORITES, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(STORES.FAVORITES).get(trackId)
  );
  await transactionToPromise(transaction);
  db.close();
  return Boolean(result);
}

export async function savePlaylist(playlist) {
  if (!playlist?.id) throw new Error("Playlist sem ID.");

  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.PLAYLISTS, "readwrite");

  transaction.objectStore(STORES.PLAYLISTS).put({
    ...playlist,
    updatedAt: playlist.updatedAt ?? new Date().toISOString()
  });

  await transactionToPromise(transaction);
  db.close();
}

export async function getPlaylists() {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.PLAYLISTS, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(STORES.PLAYLISTS).getAll()
  );
  await transactionToPromise(transaction);
  db.close();
  return result;
}

export async function addHistoryEntry(entry) {
  if (!entry?.trackId) throw new Error("Histórico sem trackId.");

  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.HISTORY, "readwrite");

  transaction.objectStore(STORES.HISTORY).add({
    ...entry,
    playedAt: entry.playedAt ?? new Date().toISOString()
  });

  await transactionToPromise(transaction);
  db.close();
}

export async function getHistory() {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.HISTORY, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(STORES.HISTORY).getAll()
  );
  await transactionToPromise(transaction);
  db.close();
  return result.sort(
    (a, b) => new Date(b.playedAt) - new Date(a.playedAt)
  );
}

export async function setSetting(key, value) {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.SETTINGS, "readwrite");

  transaction.objectStore(STORES.SETTINGS).put({ key, value });

  await transactionToPromise(transaction);
  db.close();
}

export async function getSetting(key) {
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.SETTINGS, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(STORES.SETTINGS).get(key)
  );
  await transactionToPromise(transaction);
  db.close();
  return result?.value;
}

export { DB_NAME, DB_VERSION, STORES };
