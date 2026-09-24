import { addFavorite, addHistoryEntry, isFavorite, removeFavorite } from "../storage/indexeddb.js";
import { rememberLastTrack } from "./screen-memory.js";

const AUDIO_BASE = "https://api.audius.co/v1";

let audio = null;
let currentTrack = null;
let elements = null;
let hero = null;
let lastHistoryTrackId = null;

function streamUrl(trackId) {
  return `${AUDIO_BASE}/tracks/${encodeURIComponent(trackId)}/stream`;
}

function durationLabel(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "0:00";
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, "0")}`;
}

function refreshIcons(root) {
  window.lucide?.createIcons({ root, attrs: { "stroke-width": 1.8 } });
}

function setIcon(name) {
  const targets = [elements?.toggle, hero?.toggle].filter(Boolean);
  for (const target of targets) {
    target.innerHTML = `<i data-lucide="${name}"></i>`;
    target.setAttribute("aria-label", name === "pause" ? "Pausar" : "Reproduzir");
    refreshIcons(target);
  }
}

function updateProgress() {
  if (!audio || !elements) return;
  const duration = Number.isFinite(audio.duration) ? audio.duration : Number(currentTrack?.duration) || 0;
  const current = audio.currentTime || 0;
  const percent = duration > 0 ? String((current / duration) * 100) : "0";

  elements.current.textContent = durationLabel(current);
  elements.total.textContent = durationLabel(duration);
  elements.progress.value = percent;

  if (hero) {
    hero.current.textContent = durationLabel(current);
    hero.total.textContent = durationLabel(duration);
    hero.progress.value = percent;
  }
}

function updatePlayingState() {
  if (!elements) return;
  const playing = Boolean(audio && !audio.paused);
  setIcon(playing ? "pause" : "play");
  elements.player.classList.toggle("is-playing", playing);
  if (hero) {
    hero.status.textContent = playing ? "REPRODUZINDO" : "PAUSADO";
    hero.player.classList.toggle("is-playing", playing);
  }
}

function updateActionState(group, favorite) {
  if (!group?.favorite) return;
  group.favorite.classList.toggle("is-favorite", favorite);
  group.favorite.setAttribute("aria-pressed", String(favorite));
  const label = favorite ? "Favoritado" : "Favoritar";
  group.favorite.querySelector("span").textContent = label;
}

async function updateFavoriteState() {
  if (!currentTrack?.id) return;
  try {
    const favorite = await isFavorite(currentTrack.id);
    updateActionState(elements, favorite);
    updateActionState(hero, favorite);
  } catch {
    elements.status.textContent = "Não foi possível acessar Favoritos.";
  }
}

async function toggleFavorite() {
  if (!currentTrack?.id) return;
  try {
    const favorite = await isFavorite(currentTrack.id);
    if (favorite) {
      await removeFavorite(currentTrack.id);
      elements.status.textContent = "Removida dos favoritos";
    } else {
      await addFavorite(currentTrack);
      elements.status.textContent = "Adicionada aos favoritos";
    }
    await updateFavoriteState();
  } catch {
    elements.status.textContent = "Não foi possível salvar o favorito.";
  }
}

async function shareTrack() {
  if (!currentTrack?.permalink) {
    elements.status.textContent = "Esta música não possui link para compartilhar.";
    return;
  }

  const title = currentTrack.title || "Música Audius";
  const artist = currentTrack.artist || currentTrack.handle || "Artista Audius";
  const shareData = { title, text: `${title} — ${artist}`, url: currentTrack.permalink };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      elements.status.textContent = "Compartilhado";
      return;
    }
    await navigator.clipboard.writeText(currentTrack.permalink);
    elements.status.textContent = "Link copiado";
  } catch (error) {
    if (error?.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(currentTrack.permalink);
      elements.status.textContent = "Link copiado";
    } catch {
      elements.status.textContent = "Não foi possível compartilhar.";
    }
  }
}

function toggleMenu(group) {
  if (!group?.menu || !group.more) return;
  const open = group.menu.hidden;
  closeMenus();
  group.menu.hidden = !open;
  group.more.setAttribute("aria-expanded", String(open));
}

function closeMenus() {
  for (const group of [elements, hero].filter(Boolean)) {
    group.menu.hidden = true;
    group.more.setAttribute("aria-expanded", "false");
  }
}

function addCurrentTrackToPlaylist() {
  if (!currentTrack?.id) return;
  window.dispatchEvent(new CustomEvent("audius:playlist-picker", { detail: { track: currentTrack } }));
  closeMenus();
}

function openAudius() {
  if (!currentTrack?.permalink) return;
  window.open(currentTrack.permalink, "_blank", "noopener,noreferrer");
  closeMenus();
}

async function copyTrackLink() {
  if (!currentTrack?.permalink) return;
  try {
    await navigator.clipboard.writeText(currentTrack.permalink);
    elements.status.textContent = "Link copiado";
  } catch {
    elements.status.textContent = "Não foi possível copiar o link.";
  }
  closeMenus();
}

function bindActionGroup(group, type) {
  group.favorite.addEventListener("click", toggleFavorite);
  group.share.addEventListener("click", shareTrack);
  group.more.addEventListener("click", () => toggleMenu(group));
  group.openAudius.addEventListener("click", openAudius);
  group.copy.addEventListener("click", copyTrackLink);
  group.addToPlaylist?.addEventListener("click", addCurrentTrackToPlaylist);
  group.toggle.addEventListener("click", toggle);
  group.progress.addEventListener("input", event => seek(event.target.value, group));
}

function setGroupTrack(group, track) {
  group.title.textContent = track.title || "Sem título";
  group.artist.textContent = track.artist || track.handle || "Artista Audius";
  group.artwork.src = track.artwork || "";
  group.artwork.alt = "";
}


function scrollToFullPlayer({ smooth = true } = {}) {
  if (!hero?.player || hero.player.hidden) return;

  const topbar = document.querySelector(".topbar");
  const offset = (topbar?.getBoundingClientRect().height || 0) + 12;
  const targetY = Math.max(0, window.scrollY + hero.player.getBoundingClientRect().top - offset);
  const distance = Math.abs(targetY - window.scrollY);

  // If the full player is already comfortably visible, do not move the page.
  if (distance < 32) return;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  window.scrollTo({
    top: targetY,
    behavior: smooth && !reducedMotion ? "smooth" : "auto"
  });
}

function schedulePlayerScroll() {
  // Wait for the Hero to finish its layout change before calculating its position.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scrollToFullPlayer());
  });
}

function loadTrack(track, autoplay = true, options = {}) {
  const shouldScroll = options.scroll !== false;
  const shouldLoadAudio = options.loadAudio !== false;
  if (!track?.id) return;

  currentTrack = track;
  setGroupTrack(elements, track);
  setGroupTrack(hero, track);
  elements.player.hidden = false;
  hero.content.hidden = false;
  hero.intro.hidden = true;

  if (!audio) {
    audio = new Audio();
    audio.preload = "metadata";
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("play", () => {
      updatePlayingState();
      if (currentTrack?.id && currentTrack.id !== lastHistoryTrackId) {
        lastHistoryTrackId = currentTrack.id;
        addHistoryEntry({
          trackId: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist || currentTrack.handle,
          artwork: currentTrack.artwork,
          permalink: currentTrack.permalink
        }).catch(() => {});
      }
    });
    audio.addEventListener("pause", updatePlayingState);
    audio.addEventListener("ended", () => {
      updatePlayingState();
      elements.progress.value = "0";
      elements.current.textContent = "0:00";
      hero.progress.value = "0";
      hero.current.textContent = "0:00";
    });
    audio.addEventListener("error", () => {
      elements.player.classList.add("has-error");
      elements.status.textContent = "Não foi possível reproduzir esta faixa.";
      updatePlayingState();
    });
  }

  closeMenus();
  elements.player.classList.remove("has-error");
  hero.player.classList.remove("has-error");
  elements.status.textContent = autoplay ? "Conectando ao Audius…" : "PRONTO";
  hero.status.textContent = autoplay ? "CONECTANDO" : "PRONTO";
  if (shouldLoadAudio) {
    audio.src = streamUrl(track.id);
    audio.load();
  }
  updateFavoriteState();

  if (autoplay && shouldLoadAudio) {
    audio.play()
      .then(() => {
        elements.status.textContent = "Reproduzindo";
        updatePlayingState();
      })
      .catch(() => {
        elements.status.textContent = "Toque em play para iniciar";
        hero.status.textContent = "TOQUE EM PLAY";
        updatePlayingState();
      });
  } else if (!autoplay) {
    updatePlayingState();
  }

  rememberLastTrack(track);
  window.dispatchEvent(new CustomEvent("audius:track-loaded", { detail: track }));
  if (shouldScroll) schedulePlayerScroll();
}

function toggle() {
  if (!audio || !currentTrack) return;
  if (audio.paused) {
    audio.play()
      .then(() => {
        elements.status.textContent = "Reproduzindo";
        updatePlayingState();
      })
      .catch(() => {
        elements.status.textContent = "Não foi possível iniciar.";
      });
  } else {
    audio.pause();
  }
}

function seek(value, group) {
  if (!audio || !Number.isFinite(audio.duration)) return;
  const position = (Number(value) / 100) * audio.duration;
  audio.currentTime = position;
  if (group !== elements && elements.progress) elements.progress.value = String(value);
  if (group !== hero && hero?.progress) hero.progress.value = String(value);
}

export function initPlayer(root) {
  elements = {
    player: root,
    artwork: root.querySelector("[data-player-artwork]"),
    title: root.querySelector("[data-player-title]"),
    artist: root.querySelector("[data-player-artist]"),
    status: root.querySelector("[data-player-status]"),
    current: root.querySelector("[data-player-current]"),
    total: root.querySelector("[data-player-total]"),
    progress: root.querySelector("[data-player-progress]"),
    toggle: root.querySelector("[data-player-toggle]"),
    favorite: root.querySelector("[data-player-favorite]"),
    share: root.querySelector("[data-player-share]"),
    more: root.querySelector("[data-player-more]"),
    menu: root.querySelector("[data-player-menu]"),
    openAudius: root.querySelector("[data-player-open-audius]"),
    copy: root.querySelector("[data-player-copy]"),
    addToPlaylist: root.querySelector("[data-player-add-playlist]")
  };

  const heroRoot = document.querySelector("#hero-player");
  hero = {
    player: heroRoot,
    intro: heroRoot.querySelector("[data-hero-intro]"),
    content: heroRoot.querySelector("[data-hero-content]"),
    artwork: heroRoot.querySelector("[data-hero-artwork]"),
    title: heroRoot.querySelector("[data-hero-title]"),
    artist: heroRoot.querySelector("[data-hero-artist]"),
    status: heroRoot.querySelector("[data-hero-status]"),
    current: heroRoot.querySelector("[data-hero-current]"),
    total: heroRoot.querySelector("[data-hero-total]"),
    progress: heroRoot.querySelector("[data-hero-progress]"),
    toggle: heroRoot.querySelector("[data-hero-toggle]"),
    favorite: heroRoot.querySelector("[data-hero-favorite]"),
    share: heroRoot.querySelector("[data-hero-share]"),
    more: heroRoot.querySelector("[data-hero-more]"),
    menu: heroRoot.querySelector("[data-hero-menu]"),
    openAudius: heroRoot.querySelector("[data-hero-open-audius]"),
    copy: heroRoot.querySelector("[data-hero-copy]"),
    addToPlaylist: heroRoot.querySelector("[data-hero-add-playlist]")
  };

  bindActionGroup(elements, "mini");
  bindActionGroup(hero, "hero");

  // Tocar no corpo do mini-player leva suavemente de volta ao Player Completo.
  // Controles internos continuam com seu comportamento normal.
  elements.player.addEventListener("click", event => {
    if (event.target.closest("button, input, a")) return;
    scrollToFullPlayer();
  });

  document.addEventListener("click", event => {
    if (!elements.player.contains(event.target) && !hero.player.contains(event.target)) closeMenus();
  });

  window.addEventListener("audius:play-track", event => loadTrack(event.detail, true));
  window.addEventListener("audius:restore-track", event => {
    loadTrack(event.detail, false, { scroll: false, loadAudio: false });
  });
  window.addEventListener("beforeunload", () => audio?.pause());

  refreshIcons(root);
  refreshIcons(heroRoot);
}
