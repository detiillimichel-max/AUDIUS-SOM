import { getSetting, setSetting } from "../storage/indexeddb.js";

const LAST_SCREEN_KEY = "last-screen";
const SAVE_DELAY = 700;
const RESTORE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

let saveTimer = null;
let restoring = false;

function readPosition() {
  return {
    scrollY: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0)),
    savedAt: Date.now()
  };
}

async function savePosition() {
  try {
    await setSetting(LAST_SCREEN_KEY, readPosition());
  } catch {
    // A memória da tela é um recurso auxiliar; não deve afetar o player ou catálogo.
  }
}

function scheduleSave() {
  if (restoring) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePosition, SAVE_DELAY);
}

export async function restoreLastScreen() {
  try {
    const saved = await getSetting(LAST_SCREEN_KEY);
    const scrollY = Number(saved?.scrollY);
    const savedAt = Number(saved?.savedAt);

    if (!Number.isFinite(scrollY) || scrollY < 1) return;
    if (Number.isFinite(savedAt) && Date.now() - savedAt > RESTORE_MAX_AGE) return;

    restoring = true;

    // O catálogo local precisa terminar de ocupar a página antes da restauração.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "auto" });
        requestAnimationFrame(() => {
          restoring = false;
        });
      });
    });
  } catch {
    restoring = false;
  }
}

export function initScreenMemory() {
  window.addEventListener("scroll", scheduleSave, { passive: true });
  window.addEventListener("pagehide", () => {
    clearTimeout(saveTimer);
    savePosition();
  });
}
