import { getFavorites, getHistory, getPlaylists, removeFavorite } from "../storage/indexeddb.js";

function text(value, fallback = "Sem informação") {
  return String(value ?? fallback);
}

function artwork(track) {
  return typeof track?.artwork === "string" && /^https?:\/\//i.test(track.artwork)
    ? track.artwork
    : "";
}

function card(track, removable = false) {
  const item = document.createElement("article");
  item.className = "library-track";

  const src = artwork(track);
  if (src) {
    const image = document.createElement("img");
    image.src = src;
    image.loading = "lazy";
    image.alt = "";
    image.className = "library-track-art";
    image.addEventListener("error", () => image.remove(), { once: true });
    item.append(image);
  }

  const info = document.createElement("div");
  info.className = "library-track-info";

  const title = document.createElement("strong");
  title.textContent = text(track?.title, "Sem título");

  const artist = document.createElement("span");
  artist.textContent = text(track?.artist || track?.handle, "Artista Audius");

  info.append(title, artist);

  const actions = document.createElement("div");
  actions.className = "library-track-actions";

  const play = document.createElement("button");
  play.type = "button";
  play.className = "library-play";
  play.innerHTML = '<i data-lucide="play"></i><span>Ouvir</span>';
  play.addEventListener("click", () => {
    if (track?.id) window.dispatchEvent(new CustomEvent("audius:play-track", { detail: track }));
  });
  actions.append(play);

  if (removable) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "library-remove";
    remove.setAttribute("aria-label", "Remover dos favoritos");
    remove.innerHTML = '<i data-lucide="heart-off"></i>';
    remove.addEventListener("click", async () => {
      if (!track?.id) return;
      await removeFavorite(track.id);
      item.remove();
      window.dispatchEvent(new Event("audius:library-changed"));
    });
    actions.append(remove);
  }

  item.append(info, actions);
  return item;
}

function empty(title, message, icon) {
  const box = document.createElement("div");
  box.className = "library-empty";
  box.innerHTML = `<i data-lucide="${icon}"></i>`;
  const h = document.createElement("strong");
  h.textContent = title;
  const p = document.createElement("span");
  p.textContent = message;
  box.append(h, p);
  return box;
}

function renderSection(container, title, icon, content) {
  container.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "library-section-heading";
  heading.innerHTML = `<i data-lucide="${icon}"></i>`;
  const h = document.createElement("h3");
  h.textContent = title;
  heading.append(h);
  container.append(heading, content);
}

export async function renderLibrary(root) {
  const favorites = await getFavorites();
  const playlists = await getPlaylists();
  const history = await getHistory();

  const fragment = document.createDocumentFragment();
  const nav = document.createElement("div");
  nav.className = "library-nav";
  nav.innerHTML = '<button class="library-tab is-active" data-library-tab="favorites">❤️ Favoritos</button><button class="library-tab" data-library-tab="playlists">📀 Playlists</button><button class="library-tab" data-library-tab="history">🕘 Histórico</button><button class="library-tab" data-library-tab="settings">⚙️ Configurações</button>';

  const panel = document.createElement("div");
  panel.className = "library-panel";

  const renderPanel = (name) => {
    const content = document.createElement("div");
    content.className = "library-list";

    if (name === "favorites") {
      if (!favorites.length) content.append(empty("Nenhum favorito ainda", "As músicas que você marcar com ❤️ aparecerão aqui.", "heart"));
      else favorites.slice().reverse().forEach(track => content.append(card(track, true)));
      renderSection(panel, "Favoritos", "heart", content);
      return;
    }

    if (name === "playlists") {
      if (!playlists.length) content.append(empty("Nenhuma playlist ainda", "As playlists serão criadas e ficarão guardadas somente neste aparelho.", "disc-3"));
      else playlists.forEach(playlist => {
        const row = document.createElement("div");
        row.className = "library-simple-row";
        row.innerHTML = '<i data-lucide="list-music"></i>';
        const name = document.createElement("strong");
        name.textContent = text(playlist?.name, "Playlist sem nome");
        row.append(name);
        content.append(row);
      });
      renderSection(panel, "Playlists", "disc-3", content);
      return;
    }

    if (name === "history") {
      if (!history.length) content.append(empty("Histórico vazio", "As músicas reproduzidas poderão aparecer aqui.", "history"));
      else history.slice(0, 30).forEach(entry => content.append(card(entry, false)));
      renderSection(panel, "Histórico", "history", content);
      return;
    }

    const settings = document.createElement("div");
    settings.className = "library-settings";
    settings.innerHTML = '<div><i data-lucide="shield-check"></i><strong>Dados locais protegidos pela arquitetura local-first</strong></div>';
    const p = document.createElement("p");
    p.textContent = "Favoritos, playlists, histórico e preferências ficam no IndexedDB deste aparelho. O catálogo rotativo é separado e pode ser atualizado sem apagar seus dados.";
    settings.append(p);
    renderSection(panel, "Configurações", "settings", settings);
  };

  nav.addEventListener("click", event => {
    const tab = event.target.closest("[data-library-tab]");
    if (!tab) return;
    nav.querySelectorAll(".library-tab").forEach(button => button.classList.toggle("is-active", button === tab));
    renderPanel(tab.dataset.libraryTab);
    window.lucide?.createIcons({ root: panel, attrs: { "stroke-width": 1.8 } });
  });

  fragment.append(nav, panel);
  root.replaceChildren(fragment);
  renderPanel("favorites");
  window.lucide?.createIcons({ root, attrs: { "stroke-width": 1.8 } });

  window.addEventListener("audius:library-changed", () => renderLibrary(root), { once: true });
}
