function safeText(value, fallback = "Sem informação") {
  return String(value ?? fallback);
}

function artworkFor(track) {
  return typeof track?.artwork === "string" && /^https?:\/\//i.test(track.artwork)
    ? track.artwork
    : "";
}

function durationLabel(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "";
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, "0")}`;
}

function trackCard(track) {
  const article = document.createElement("article");
  article.className = "track";

  const artwork = artworkFor(track);
  if (artwork) {
    const image = document.createElement("img");
    image.className = "art";
    image.loading = "lazy";
    image.alt = "";
    image.src = artwork;
    image.addEventListener("error", () => {
      image.replaceWith(createPlaceholder(track));
    }, { once: true });
    article.append(image);
  } else {
    article.append(createPlaceholder(track));
  }

  const body = document.createElement("div");
  body.className = "track-body";

  const title = document.createElement("div");
  title.className = "track-title";
  title.textContent = safeText(track?.title);

  const artist = document.createElement("div");
  artist.className = "track-artist";
  artist.textContent = track?.artist || track?.handle || "Artista Audius";

  const meta = document.createElement("div");
  meta.className = "track-meta";
  const genre = document.createElement("span");
  genre.textContent = track?.genre || "Audius";
  const duration = document.createElement("span");
  duration.textContent = durationLabel(track?.duration);
  meta.append(genre, duration);

  const button = document.createElement("button");
  button.className = "play";
  button.type = "button";
  button.innerHTML = '<i data-lucide="play"></i><span>Ouvir</span>';
  button.addEventListener("click", () => {
    if (!track?.permalink || !/^https?:\/\//i.test(track.permalink)) return;
    window.open(track.permalink, "_blank", "noopener,noreferrer");
  });

  body.append(title, artist, meta, button);
  article.append(body);
  return article;
}

function createPlaceholder(track) {
  const placeholder = document.createElement("div");
  placeholder.className = "art art-placeholder";
  placeholder.setAttribute("aria-label", `Capa indisponível: ${safeText(track?.title)}`);
  placeholder.innerHTML = '<i data-lucide="music-2"></i>';
  return placeholder;
}

export function renderCatalog(container, blocks = []) {
  container.replaceChildren();

  for (const block of blocks) {
    if (!Array.isArray(block?.tracks) || !block.tracks.length) continue;

    const section = document.createElement("section");
    section.className = "block";

    const heading = document.createElement("h3");
    heading.textContent = block.label || block.blockId || "Descobertas";

    const row = document.createElement("div");
    row.className = "track-row";

    for (const track of block.tracks) row.append(trackCard(track));

    section.append(heading, row);
    container.append(section);
  }
}
