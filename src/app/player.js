import { addFavorite, isFavorite, removeFavorite } from "../storage/indexeddb.js";

const AUDIO_BASE = "https://api.audius.co/v1";

let audio = null;
let currentTrack = null;
let elements = null;
let hero = null;

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
  group.toggle.addEventListener("click", toggle);
  group.progress.addEventListener("input", event => seek(event.target.value, group));
}

function setGroupTrack(group, track) {
  group.title.textContent = track.title || "Sem título";
  group.artist.textContent = track.artist || track.handle || "Artista Audius";
  group.artwork.src = track.artwork || "";
  group.artwork.alt = "";
}

function loadTrack(track, autoplay = true) {
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
    audio.addEventListener("play", updatePlayingState);
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
  elements.status.textContent = "Conectando ao Audius…";
  hero.status.textContent = "CONECTANDO";
  audio.src = streamUrl(track.id);
  audio.load();
  updateFavoriteState();

  if (autoplay) {
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
  }

  window.dispatchEvent(new CustomEvent("audius:track-loaded", { detail: track }));
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
    copy: root.querySelector("[data-player-copy]")
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
    copy: heroRoot.querySelector("[data-hero-copy]")
  };

  bindActionGroup(elements, "mini");
  bindActionGroup(hero, "hero");

  document.addEventListener("click", event => {
    if (!elements.player.contains(event.target) && !hero.player.contains(event.target)) closeMenus();
  });

  window.addEventListener("audius:play-track", event => loadTrack(event.detail, true));
  window.addEventListener("beforeunload", () => audio?.pause());

  refreshIcons(root);
  refreshIcons(heroRoot);
}
