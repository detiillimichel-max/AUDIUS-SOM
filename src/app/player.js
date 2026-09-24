import { addFavorite, isFavorite, removeFavorite } from "../storage/indexeddb.js";

const AUDIO_BASE = "https://api.audius.co/v1";

let audio = null;
let currentTrack = null;
let elements = null;

function streamUrl(trackId) {
  return `${AUDIO_BASE}/tracks/${encodeURIComponent(trackId)}/stream`;
}

function durationLabel(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "0:00";
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, "0")}`;
}

function refreshIcons(root) {
  window.lucide?.createIcons({
    root,
    attrs: { "stroke-width": 1.8 }
  });
}

function setIcon(name) {
  if (!elements?.toggle) return;
  elements.toggle.innerHTML = `<i data-lucide="${name}"></i>`;
  refreshIcons(elements.toggle);
}

function updateProgress() {
  if (!audio || !elements) return;
  const duration = Number.isFinite(audio.duration) ? audio.duration : Number(currentTrack?.duration) || 0;
  const current = audio.currentTime || 0;
  elements.current.textContent = durationLabel(current);
  elements.total.textContent = durationLabel(duration);
  elements.progress.value = duration > 0 ? String((current / duration) * 100) : "0";
}

function updatePlayingState() {
  if (!elements) return;
  setIcon(audio?.paused ? "play" : "pause");
  elements.player.classList.toggle("is-playing", Boolean(audio && !audio.paused));
}

async function updateFavoriteState() {
  if (!elements?.favorite || !currentTrack?.id) return;
  try {
    const favorite = await isFavorite(currentTrack.id);
    elements.favorite.classList.toggle("is-favorite", favorite);
    elements.favorite.setAttribute("aria-pressed", String(favorite));
    elements.favorite.querySelector("span").textContent = favorite ? "Favoritado" : "Favoritar";
    elements.favorite.querySelector("i")?.setAttribute("data-lucide", favorite ? "heart" : "heart");
    refreshIcons(elements.favorite);
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
  const shareData = {
    title,
    text: `${title} — ${artist}`,
    url: currentTrack.permalink
  };

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

function toggleMenu() {
  if (!elements?.menu || !elements.more) return;
  const open = elements.menu.hidden;
  elements.menu.hidden = !open;
  elements.more.setAttribute("aria-expanded", String(open));
}

function closeMenu() {
  if (!elements?.menu || !elements.more) return;
  elements.menu.hidden = true;
  elements.more.setAttribute("aria-expanded", "false");
}

function openAudius() {
  if (!currentTrack?.permalink) return;
  window.open(currentTrack.permalink, "_blank", "noopener,noreferrer");
  closeMenu();
}

async function copyTrackLink() {
  if (!currentTrack?.permalink) return;
  try {
    await navigator.clipboard.writeText(currentTrack.permalink);
    elements.status.textContent = "Link copiado";
  } catch {
    elements.status.textContent = "Não foi possível copiar o link.";
  }
  closeMenu();
}

function loadTrack(track, autoplay = true) {
  if (!track?.id) return;

  currentTrack = track;
  elements.title.textContent = track.title || "Sem título";
  elements.artist.textContent = track.artist || track.handle || "Artista Audius";
  elements.artwork.src = track.artwork || "";
  elements.artwork.alt = "";
  elements.player.hidden = false;

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
    });
    audio.addEventListener("error", () => {
      elements.player.classList.add("has-error");
      elements.status.textContent = "Não foi possível reproduzir esta faixa.";
      updatePlayingState();
    });
  }

  closeMenu();
  elements.player.classList.remove("has-error");
  elements.status.textContent = "Conectando ao Audius…";
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

function seek(value) {
  if (!audio || !Number.isFinite(audio.duration)) return;
  audio.currentTime = (Number(value) / 100) * audio.duration;
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

  elements.toggle.addEventListener("click", toggle);
  elements.progress.addEventListener("input", event => seek(event.target.value));
  elements.favorite.addEventListener("click", toggleFavorite);
  elements.share.addEventListener("click", shareTrack);
  elements.more.addEventListener("click", toggleMenu);
  elements.openAudius.addEventListener("click", openAudius);
  elements.copy.addEventListener("click", copyTrackLink);

  document.addEventListener("click", event => {
    if (!elements.player.contains(event.target)) closeMenu();
  });

  window.addEventListener("audius:play-track", event => loadTrack(event.detail, true));
  window.addEventListener("beforeunload", () => audio?.pause());

  refreshIcons(root);
}
