const DB_NAME = "audius-som";
const DB_VERSION = 3;

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

      // Migração v2: descarta somente o catálogo rotativo.
      // Favoritos, playlists, histórico e configurações permanecem intactos.
      if (request.oldVersion < 2 && db.objectStoreNames.contains(STORES.CATALOG_BLOCKS)) {
        request.transaction.objectStore(STORES.CATALOG_BLOCKS).clear();
      }
      // Migração v3: nenhuma store de usuário é apagada. A biblioteca reutiliza
      // Favorites, Playlists, History e Settings que já existiam.
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
  const result = await requestToPromise(transaction.objectStore(STORES.PLAYLISTS).getAll());
  await transactionToPromise(transaction);
  db.close();
  return result.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

function createLocalId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return prefix + "-" + globalThis.crypto.randomUUID();
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

export async function createPlaylist(name) {
  const cleanName = String(name ?? "").trim();
  if (!cleanName) throw new Error("A playlist precisa de um nome.");
  if (cleanName.length > 60) throw new Error("O nome da playlist deve ter no máximo 60 caracteres.");
  const now = new Date().toISOString();
  const playlist = { id: createLocalId("playlist"), name: cleanName, tracks: [], createdAt: now, updatedAt: now };
  await savePlaylist(playlist);
  return playlist;
}

export async function getPlaylist(playlistId) {
  if (!playlistId) return null;
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.PLAYLISTS, "readonly");
  const result = await requestToPromise(transaction.objectStore(STORES.PLAYLISTS).get(playlistId));
  await transactionToPromise(transaction);
  db.close();
  return result ?? null;
}

export async function addTrackToPlaylist(playlistId, track) {
  if (!playlistId) throw new Error("Playlist inválida.");
  if (!track?.id) throw new Error("Faixa inválida para a playlist.");
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.PLAYLISTS, "readwrite");
  const store = transaction.objectStore(STORES.PLAYLISTS);
  const playlist = await requestToPromise(store.get(playlistId));
  if (!playlist) throw new Error("Playlist não encontrada.");
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks.slice() : [];
  if (!tracks.some(item => item?.id === track.id)) tracks.push(track);
  store.put({ ...playlist, tracks, updatedAt: new Date().toISOString() });
  await transactionToPromise(transaction);
  db.close();
}

export async function removeTrackFromPlaylist(playlistId, trackId) {
  if (!playlistId || !trackId) throw new Error("Playlist ou faixa inválida.");
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.PLAYLISTS, "readwrite");
  const store = transaction.objectStore(STORES.PLAYLISTS);
  const playlist = await requestToPromise(store.get(playlistId));
  if (!playlist) throw new Error("Playlist não encontrada.");
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks.filter(track => track?.id !== trackId) : [];
  store.put({ ...playlist, tracks, updatedAt: new Date().toISOString() });
  await transactionToPromise(transaction);
  db.close();
}

export async function deletePlaylist(playlistId) {
  if (!playlistId) throw new Error("Playlist inválida.");
  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.PLAYLISTS, "readwrite");
  transaction.objectStore(STORES.PLAYLISTS).delete(playlistId);
  await transactionToPromise(transaction);
  db.close();
}

export async function addHistoryEntry(entry) {
  if (!entry?.trackId) throw new Error("Histórico sem trackId.");

  const db = await openAudiusDB();
  const transaction = db.transaction(STORES.HISTORY, "readwrite");

  const store = transaction.objectStore(STORES.HISTORY);
  store.add({
    ...entry,
    playedAt: entry.playedAt ?? new Date().toISOString()
  });

  // Limite local de segurança: mantém somente as 100 reproduções mais recentes.
  const all = await requestToPromise(store.getAll());
  if (all.length > 100) {
    all
      .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))
      .slice(100)
      .forEach(item => store.delete(item.id));
  }

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
