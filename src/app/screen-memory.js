import { getSetting, setSetting } from "../storage/indexeddb.js";

const LAST_SCREEN_KEY = "last-screen";
const SAVE_DELAY = 120;
const RESTORE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

let saveTimer = null;
let restoring = false;
let lastTrack = null;

function readPosition() {
  return {
    scrollY: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0)),
    savedAt: Date.now()
  };
}

async function saveScreenState(extra = {}) {
  try {
    const current = await getSetting(LAST_SCREEN_KEY);
    await setSetting(LAST_SCREEN_KEY, {
      ...(current && typeof current === "object" ? current : {}),
      ...readPosition(),
      ...extra
    });
  } catch {
    // A memória da tela é auxiliar e nunca deve bloquear o app.
  }
}

function scheduleSave() {
  if (restoring) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveScreenState(), SAVE_DELAY);
}

export async function rememberLastTrack(track) {
  if (!track?.id) return;
  lastTrack = track;
  await saveScreenState({ track });
}

export async function restoreLastScreen() {
  try {
    const saved = await getSetting(LAST_SCREEN_KEY);
    const scrollY = Number(saved?.scrollY);
    const savedAt = Number(saved?.savedAt);

    const validAge = !Number.isFinite(savedAt) || Date.now() - savedAt <= RESTORE_MAX_AGE;
    const hasPosition = Number.isFinite(scrollY) && scrollY >= 1;

    if (!validAge) return false;

    restoring = true;

    if (hasPosition) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY, behavior: "auto" });
          requestAnimationFrame(() => {
            restoring = false;
          });
        });
      });
    } else {
      restoring = false;
    }

    if (saved?.track?.id) {
      window.dispatchEvent(new CustomEvent("audius:restore-track", {
        detail: saved.track
      }));
    }

    return hasPosition || Boolean(saved?.track?.id);
  } catch {
    restoring = false;
    return false;
  }
}

export function initScreenMemory() {
  window.addEventListener("scroll", scheduleSave, { passive: true });

  window.addEventListener("pagehide", () => {
    clearTimeout(saveTimer);
    // O último estado normalmente já foi salvo durante a rolagem.
    // Esta chamada reforça a posição final sem depender dela para o player.
    saveScreenState({ track: lastTrack ?? undefined });
  });
}
