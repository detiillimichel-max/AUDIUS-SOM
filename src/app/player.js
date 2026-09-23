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

function setIcon(name) {
  if (!elements?.toggle) return;
  elements.toggle.innerHTML = `<i data-lucide="${name}"></i>`;
  window.lucide?.createIcons({ root: elements.toggle, attrs: { "stroke-width": 1.8 } });
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

  elements.player.classList.remove("has-error");
  elements.status.textContent = "Conectando ao Audius…";
  audio.src = streamUrl(track.id);
  audio.load();

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
    toggle: root.querySelector("[data-player-toggle]")
  };

  elements.toggle.addEventListener("click", toggle);
  elements.progress.addEventListener("input", (event) => seek(event.target.value));

  window.addEventListener("audius:play-track", (event) => {
    loadTrack(event.detail, true);
  });

  window.addEventListener("beforeunload", () => audio?.pause());
}
