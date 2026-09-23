import { startCatalog } from "../storage/catalog-sync.js";

function dispatchCatalogEvent(name, detail) {
  window.dispatchEvent(
    new CustomEvent(name, {
      detail
    })
  );
}

export async function startApp() {
  const { initial, syncPromise } = await startCatalog();

  // Primeiro evento: a interface pode renderizar o IndexedDB sem esperar a rede.
  dispatchCatalogEvent("audius:catalog-ready", initial);

  // Segundo evento: atualização silenciosa quando o catálogo remoto terminar.
  syncPromise
    .then((result) => {
      dispatchCatalogEvent("audius:catalog-updated", result);
    })
    .catch((error) => {
      dispatchCatalogEvent("audius:catalog-update-error", {
        error: error instanceof Error ? error : new Error(String(error))
      });
    });

  return initial;
}
