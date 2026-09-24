import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  getFavorites,
  getHistory,
  getPlaylist,
  getPlaylists,
  removeFavorite,
  removeTrackFromPlaylist
} from "../storage/indexeddb.js";

function text(value, fallback = "Sem informação") { return String(value ?? fallback); }
function artwork(track) { return typeof track?.artwork === "string" && /^https?:\/\//i.test(track.artwork) ? track.artwork : ""; }
function icon(name) { const node = document.createElement("i"); node.setAttribute("data-lucide", name); return node; }
function refreshIcons(root) { window.lucide?.createIcons({ root, attrs: { "stroke-width": 1.8 } }); }

function actionButton(label, iconName, className = "library-action") {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.append(icon(iconName), document.createTextNode(label));
  return node;
}

function trackCard(track, removeKind = "", onRemove = null, featured = false) {
  const item = document.createElement("article");
  item.className = "library-track" + (featured ? " library-track-featured" : "");
  const src = artwork(track);
  if (src) {
    const image = document.createElement("img");
    image.src = src; image.loading = "lazy"; image.alt = ""; image.className = "library-track-art";
    image.addEventListener("error", () => image.remove(), { once: true });
    item.append(image);
  }
  const info = document.createElement("div"); info.className = "library-track-info";
  const title = document.createElement("strong"); title.textContent = text(track?.title, "Sem título");
  const artist = document.createElement("span"); artist.textContent = text(track?.artist || track?.handle, "Artista Audius");
  info.append(title, artist);
  const actions = document.createElement("div"); actions.className = "library-track-actions";
  const play = document.createElement("button"); play.type = "button"; play.className = "library-play"; play.setAttribute("aria-label", "Ouvir"); play.append(icon("play"));
  play.addEventListener("click", () => { if (track?.id) window.dispatchEvent(new CustomEvent("audius:play-track", { detail: track })); });
  actions.append(play);
  if (onRemove) {
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "library-remove" + (removeKind === "playlist" ? " library-remove-playlist" : "");
    remove.setAttribute("aria-label", removeKind === "playlist" ? "Remover da playlist" : "Remover dos favoritos");
    remove.append(icon(removeKind === "playlist" ? "x" : "heart-off"));
    remove.addEventListener("click", onRemove);
    actions.append(remove);
  }
  item.append(info, actions);
  return item;
}

function empty(title, message, iconName) {
  const box = document.createElement("div"); box.className = "library-empty"; box.append(icon(iconName));
  const strong = document.createElement("strong"); strong.textContent = title;
  const span = document.createElement("span"); span.textContent = message;
  box.append(strong, span); return box;
}

function renderSection(panel, title, iconName, content, action = null) {
  panel.replaceChildren();
  const heading = document.createElement("div"); heading.className = "library-section-heading"; heading.append(icon(iconName));
  const titleNode = document.createElement("h3"); titleNode.textContent = title; heading.append(titleNode);
  if (action) { const wrap = document.createElement("div"); wrap.className = "library-heading-actions"; wrap.append(action); heading.append(wrap); }
  panel.append(heading, content);
}

function createModal(title, message = "") {
  const overlay = document.createElement("div"); overlay.className = "library-modal";
  const dialog = document.createElement("div"); dialog.className = "library-modal-card"; dialog.setAttribute("role","dialog"); dialog.setAttribute("aria-modal","true");
  const heading = document.createElement("h3"); heading.textContent = title; dialog.append(heading);
  if (message) { const p = document.createElement("p"); p.textContent = message; dialog.append(p); }
  const actions = document.createElement("div"); actions.className = "library-modal-actions";
  overlay.append(dialog); document.body.append(overlay);
  overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
  return { overlay, dialog, actions };
}

function createPlaylistFlow(onCreated) {
  const modal = createModal("Criar playlist", "Dê um nome para sua playlist. Ela ficará salva neste aparelho.");
  const input = document.createElement("input"); input.type = "text"; input.maxLength = 60; input.placeholder = "Ex.: Viagem, Academia, Sertanejo..."; input.setAttribute("aria-label","Nome da playlist");
  modal.dialog.append(input);
  const cancel = actionButton("Cancelar","x","library-modal-secondary");
  const create = actionButton("Criar playlist","check","library-modal-primary");
  modal.actions.append(cancel,create); modal.dialog.append(modal.actions);
  const submit = async () => {
    const name = input.value.trim(); if (!name) { input.focus(); return; }
    try { const playlist = await createPlaylist(name); modal.overlay.remove(); window.dispatchEvent(new Event("audius:library-changed")); onCreated?.(playlist); }
    catch (error) { console.warn("Playlist:",error); }
  };
  cancel.addEventListener("click",()=>modal.overlay.remove()); create.addEventListener("click",submit);
  input.addEventListener("keydown",event=>{ if(event.key==="Enter") submit(); if(event.key==="Escape") modal.overlay.remove(); });
  refreshIcons(modal.overlay); setTimeout(()=>input.focus(),0);
}

function openPlaylistPicker(track) {
  getPlaylists().then(playlists => {
    const modal = createModal("Adicionar à playlist","Escolha onde guardar esta música.");
    const list = document.createElement("div"); list.className = "library-picker-list";
    if (!playlists.length) list.append(empty("Nenhuma playlist","Crie sua primeira playlist para adicionar esta música.","list-plus"));
    playlists.forEach(playlist => {
      const item = document.createElement("button"); item.type="button"; item.className="library-picker-item"; item.append(icon("list-music"));
      const info=document.createElement("span"); const name=document.createElement("strong"); name.textContent=text(playlist.name,"Playlist sem nome");
      const total=Array.isArray(playlist.tracks)?playlist.tracks.length:0; const count=document.createElement("small"); count.textContent=total+(total===1?" música":" músicas");
      info.append(name,count); item.append(info);
      item.addEventListener("click",async()=>{ try { await addTrackToPlaylist(playlist.id,track); modal.overlay.remove(); window.dispatchEvent(new Event("audius:library-changed")); } catch(error){ console.warn("Playlist:",error); } });
      list.append(item);
    });
    const newButton=actionButton("Nova playlist","plus","library-modal-primary library-picker-new");
    newButton.addEventListener("click",()=>{ modal.overlay.remove(); createPlaylistFlow(()=>openPlaylistPicker(track)); });
    modal.dialog.append(list,newButton,modal.actions);
    const close=actionButton("Fechar","x","library-modal-secondary"); modal.actions.append(close); close.addEventListener("click",()=>modal.overlay.remove());
    refreshIcons(modal.overlay);
  }).catch(error=>console.warn("Playlists:",error));
}

async function renderPlaylistDetail(panel, playlistId) {
  const playlist=await getPlaylist(playlistId); if(!playlist) return;
  const content=document.createElement("div"); content.className="library-list";
  const top=document.createElement("div"); top.className="library-playlist-detail-top";
  const back=actionButton("Playlists","arrow-left","library-heading-button");
  const total=Array.isArray(playlist.tracks)?playlist.tracks.length:0; const count=document.createElement("span"); count.textContent=total+(total===1?" música":" músicas");
  top.append(back,count); content.append(top); back.addEventListener("click",()=>renderPlaylists(panel));
  if(!total) content.append(empty("Playlist vazia","Abra uma música, toque em “Mais” e escolha “Adicionar à playlist”.","music"));
  else playlist.tracks.forEach((track,index)=>content.append(trackCard(track,"playlist",async()=>{ await removeTrackFromPlaylist(playlist.id,track.id); await renderPlaylistDetail(panel,playlist.id); window.dispatchEvent(new Event("audius:library-changed")); }, index === 0)));
  const deleteButton=actionButton("Excluir playlist","trash-2","library-danger-button");
  deleteButton.addEventListener("click",()=>{ const modal=createModal("Excluir playlist?","A playlist será apagada deste aparelho. As músicas originais não serão apagadas."); const cancel=actionButton("Cancelar","x","library-modal-secondary"); const confirm=actionButton("Excluir","trash-2","library-danger-button"); modal.actions.append(cancel,confirm); modal.dialog.append(modal.actions); cancel.addEventListener("click",()=>modal.overlay.remove()); confirm.addEventListener("click",async()=>{ await deletePlaylist(playlist.id); modal.overlay.remove(); window.dispatchEvent(new Event("audius:library-changed")); }); refreshIcons(modal.overlay); });
  content.append(deleteButton); renderSection(panel,playlist.name,"list-music",content); refreshIcons(panel);
}

async function renderPlaylists(panel) {
  const playlists=await getPlaylists();
  const newButton=actionButton("Nova playlist","plus","library-heading-button"); newButton.addEventListener("click",()=>createPlaylistFlow());
  const content=document.createElement("div"); content.className="library-list";
  if(!playlists.length) content.append(empty("Nenhuma playlist ainda","Crie uma playlist e depois use “Mais → Adicionar à playlist” em qualquer música.","list-music"));
  else playlists.forEach(playlist=>{ const row=document.createElement("button"); row.type="button"; row.className="library-playlist-row"; row.append(icon("list-music")); const info=document.createElement("span"); const name=document.createElement("strong"); name.textContent=text(playlist.name,"Playlist sem nome"); const total=Array.isArray(playlist.tracks)?playlist.tracks.length:0; const count=document.createElement("small"); count.textContent=total+(total===1?" música":" músicas"); info.append(name,count); row.append(info,icon("chevron-right")); row.addEventListener("click",()=>renderPlaylistDetail(panel,playlist.id)); content.append(row); });
  renderSection(panel,"Playlists","list-music",content,newButton); refreshIcons(panel);
}

export async function renderLibrary(root) {
  const favorites=await getFavorites(); const history=await getHistory();
  const fragment=document.createDocumentFragment(); const nav=document.createElement("div"); nav.className="library-nav";
  nav.innerHTML='<button class="library-tab is-active" data-library-tab="favorites">❤️ Favoritos</button><button class="library-tab" data-library-tab="playlists">📀 Playlists</button><button class="library-tab" data-library-tab="history">🕘 Histórico</button><button class="library-tab" data-library-tab="settings">⚙️ Configurações</button>';
  const panel=document.createElement("div"); panel.className="library-panel";
  const renderPanel=name=>{
    if(name==="playlists"){ renderPlaylists(panel); return; }
    const content=document.createElement("div"); content.className="library-list";
    if(name==="favorites"){
      if(!favorites.length) content.append(empty("Nenhum favorito ainda","As músicas que você marcar com ❤️ aparecerão aqui.","heart"));
      else favorites.slice().reverse().forEach(track=>content.append(trackCard(track,"favorite",async()=>{ await removeFavorite(track.id); window.dispatchEvent(new Event("audius:library-changed")); })));
      renderSection(panel,"Favoritos","heart",content);
    } else if(name==="history"){
      if(!history.length) content.append(empty("Histórico vazio","As músicas reproduzidas poderão aparecer aqui.","history"));
      else history.slice(0,30).forEach(entry=>content.append(trackCard(entry)));
      renderSection(panel,"Histórico","history",content);
    } else {
      const settings=document.createElement("div"); settings.className="library-settings"; settings.innerHTML='<div><i data-lucide="shield-check"></i><strong>Dados locais protegidos pela arquitetura local-first</strong></div>';
      const p=document.createElement("p"); p.textContent="Favoritos, playlists, histórico e preferências ficam no IndexedDB deste aparelho. O catálogo rotativo é separado e pode ser atualizado sem apagar seus dados."; settings.append(p);
      renderSection(panel,"Configurações","settings",settings);
    }
    refreshIcons(panel);
  };
  nav.addEventListener("click",event=>{ const tab=event.target.closest("[data-library-tab]"); if(!tab)return; nav.querySelectorAll(".library-tab").forEach(button=>button.classList.toggle("is-active",button===tab)); renderPanel(tab.dataset.libraryTab); });
  fragment.append(nav,panel); root.replaceChildren(fragment); renderPanel("favorites"); refreshIcons(root);
  if(!root.dataset.libraryBound){
    root.dataset.libraryBound="true";
    window.addEventListener("audius:library-changed",()=>renderLibrary(root));
    window.addEventListener("audius:playlist-picker",event=>{ if(event.detail?.track) openPlaylistPicker(event.detail.track); });
  }
}
