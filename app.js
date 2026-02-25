const APP_VERSION = "0.8.0";
const STORAGE_KEYS = {
  favorites: "recom3ndo_favorites_v1",
  packOverride: "recom3ndo_pack_override_v1",
  creatorPack: "recom3ndo_creator_pack_v1",
  guardStatus: "recom3ndo_guard_status_v1",
  assistantSettings: "recom3ndo_assistant_settings_v1",
  assistantChat: "recom3ndo_assistant_chat_v1",
  mapSettings: "recom3ndo_map_settings_v1",
  dealsSettings: "recom3ndo_deals_settings_v1",
  dealsSearches: "recom3ndo_deals_searches_v1",
  freeNotes: "recom3ndo_free_notes_v1"
};

const byId = (id) => document.getElementById(id);
const form = byId("recommendation-form");
const resultContainer = byId("results");
const summary = byId("result-summary");
const template = byId("card-template");
const detailView = byId("detail-view");

const dealsStore = RecoDealSearchStore.createStore();
const notesStore = RecoFreeNotes.createNotesStore();
let activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
let dataSource = "Default JSON";
let favorites = new Set();
let userLocation = null;
let currentItems = [];
let selectedListingId = null;
let assistantMessages = [];
let creatorModeEnabled = false;
let mapInstance = null;
let mapState = { visible: false, showMode: "results", selectedId: null };
let dealsVertical = "hotels";

function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadJson(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key) || ""); return v ?? fallback; } catch { return fallback; } }

function escapeHtml(v) { return String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function showToast(msg) { const t = byId("toast"); t.textContent = msg; t.classList.add("visible"); setTimeout(() => t.classList.remove("visible"), 1500); }
function setGuardStatus(pass) { saveJson(STORAGE_KEYS.guardStatus, { pass, timestamp: new Date().toISOString() }); }

function registerServiceWorker() { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => null); }

function loadFavorites() {
  favorites = new Set(loadJson(STORAGE_KEYS.favorites, []));
  byId("favorites-count").textContent = `Favorites: ${favorites.size}`;
}
function saveFavorites() {
  saveJson(STORAGE_KEYS.favorites, Array.from(favorites));
  byId("favorites-count").textContent = `Favorites: ${favorites.size}`;
}

function getFilters() {
  return {
    destination: byId("destination").value,
    category: byId("category").value,
    budget: byId("budget").value,
    style: byId("style").value,
    keyword: RecoM3ndo.normalize(byId("keyword").value),
    maxResults: Number(byId("max-results").value),
    verifiedOnly: byId("verified-only").checked,
    favoritesOnly: byId("favorites-only").checked,
    favoriteIds: favorites
  };
}

function setQueryFromFilters(filters) {
  const params = new URLSearchParams();
  ["destination", "category", "budget", "style", "keyword"].forEach((k) => filters[k] && params.set(k, String(filters[k])));
  params.set("max", String(filters.maxResults || 6));
  if (filters.verifiedOnly) params.set("verifiedOnly", "1");
  if (filters.favoritesOnly) params.set("favoritesOnly", "1");
  history.replaceState({}, "", `${location.pathname}?${params.toString()}`);
}

function listingMapUrl(item) { return RecoGeo.mapUrlForListing(item, userLocation); }

function listingActionsHtml(item) {
  const actions = [];
  const m = listingMapUrl(item);
  if (m) actions.push(`<a class="action-link" target="_blank" rel="noopener" href="${m}">Open in Maps</a>`);
  if (item.phone) actions.push(`<a class="action-link" href="tel:${escapeHtml(item.phone)}">Call</a>`);
  if (item.url) actions.push(`<a class="action-link" target="_blank" rel="noopener" href="${escapeHtml(item.url)}">Website</a>`);
  actions.push(`<button type="button" class="secondary open-details-btn" data-id="${escapeHtml(item.id)}">Open details</button>`);
  return actions.join("");
}

function openDetailById(id) {
  const item = activeListings.find((l) => l.id === id) || currentItems.find((l) => l.id === id);
  if (!item) return;
  selectedListingId = id;
  detailView.innerHTML = `<article class="detail-card"><button id="back-to-results" type="button" class="secondary">Back to results</button><h2>${escapeHtml(item.name)}</h2><p class="meta">${escapeHtml(item.city)} · ${escapeHtml(item.category)} · ${escapeHtml(item.budget)} budget${item.verified ? " · verified" : ""}</p><p>${escapeHtml(item.description)}</p><p>${escapeHtml(item.address || "Address unavailable")}</p><div class="actions">${listingActionsHtml(item)}</div><ul>${(item.tags || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></article>`;
  detailView.hidden = false;
  resultContainer.hidden = true;
  summary.hidden = true;
  byId("back-to-results").addEventListener("click", () => {
    detailView.hidden = true;
    resultContainer.hidden = false;
    summary.hidden = false;
    runSearch(false);
  });
}

function applySort(items) {
  const mode = byId("sort-mode").value;
  const sorted = [...items];
  if (mode === "verified") sorted.sort((a, b) => Number(b.verified) - Number(a.verified) || b.score - a.score);
  if (mode === "nearest" && userLocation) {
    sorted.sort((a, b) => {
      const da = typeof a.distanceMiles === "number" ? a.distanceMiles : Number.POSITIVE_INFINITY;
      const db = typeof b.distanceMiles === "number" ? b.distanceMiles : Number.POSITIVE_INFINITY;
      return da - db || b.score - a.score;
    });
  }
  return sorted;
}

function enrichDistance(items) {
  if (!userLocation) return items;
  return items.map((item) => {
    if (typeof item.lat === "number" && typeof item.lng === "number") {
      return { ...item, distanceMiles: RecoM3ndo.haversineMiles(userLocation, { lat: item.lat, lng: item.lng }) };
    }
    return item;
  });
}

function renderSummary(filters, items, relaxed) {
  if (!filters.destination) return (summary.textContent = "Choose a destination and submit to get started.");
  if (!items.length) return (summary.textContent = `No results found in ${filters.destination}.`);
  summary.textContent = `${relaxed ? "Relaxed" : "Exact"} match: ${items.length} result(s) for ${filters.destination}.`;
}

function renderResults(items, relaxed, filters) {
  detailView.hidden = true;
  resultContainer.hidden = false;
  summary.hidden = false;
  resultContainer.innerHTML = "";
  if (filters.favoritesOnly && favorites.size === 0) return (resultContainer.innerHTML = '<p class="empty">Favorites-only is on but no favorites are saved yet.</p>');
  if (!items.length) return (resultContainer.innerHTML = '<p class="empty">No direct matches found. Try broadening filters.</p>');

  items.forEach((item, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = item.id;
    card.querySelector(".name").textContent = item.name;
    card.querySelector(".score").textContent = `${item.score} pts`;
    const d = typeof item.distanceMiles === "number" ? ` · ${item.distanceMiles.toFixed(1)} mi` : "";
    card.querySelector(".meta").textContent = `${item.city} · ${item.category} · ${item.budget} budget${item.verified ? " · verified" : ""}${d}`;
    card.querySelector(".description").textContent = item.description;
    const fav = card.querySelector(".favorite-btn");
    fav.dataset.id = item.id;
    fav.textContent = favorites.has(item.id) ? "★" : "☆";
    fav.classList.toggle("active", favorites.has(item.id));
    const tags = card.querySelector(".tags");
    const liState = document.createElement("li");
    liState.textContent = index === 0 ? "Top match" : relaxed ? "Alternative match" : "Recommended";
    tags.appendChild(liState);
    (item.tags || []).forEach((t) => { const li = document.createElement("li"); li.textContent = t; tags.appendChild(li); });
    const why = card.querySelector(".why-list");
    (item.explanation || []).forEach((r) => { const li = document.createElement("li"); li.textContent = r; why.appendChild(li); });
    card.querySelector(".card-actions").innerHTML = listingActionsHtml(item);
    card.querySelector(".name").addEventListener("click", () => { selectedListingId = item.id; openDetailById(item.id); focusMarkerById(item.id); });
    resultContainer.appendChild(card);
  });
}

function getMapListings() {
  const mode = byId("map-show-mode").value;
  if (mode === "favorites") return activeListings.filter((l) => favorites.has(l.id));
  if (mode === "city") {
    const city = byId("destination").value;
    return activeListings.filter((l) => !city || l.city === city);
  }
  return currentItems;
}

async function ensureMap() {
  const provider = byId("map-provider").value;
  const googleKey = byId("google-maps-key").value.trim();
  saveJson(STORAGE_KEYS.mapSettings, { provider, googleKey });
  if (provider === "google" && googleKey) {
    try {
      mapInstance = await RecoMap.initGoogleMap("map", googleKey);
      return;
    } catch {
      showToast("Google Maps failed; using Leaflet.");
      byId("map-provider").value = "leaflet";
    }
  }
  mapInstance = RecoMap.initLeafletMap("map");
}

function focusMarkerById(id) {
  const item = activeListings.find((l) => l.id === id) || currentItems.find((l) => l.id === id);
  if (item && typeof item.lat === "number" && typeof item.lng === "number") RecoMap.focusLeafletMarker(item);
}

async function refreshMapMarkers() {
  if (byId("map-panel").hidden) return;
  await ensureMap();
  const list = getMapListings().filter((l) => typeof l.lat === "number" && typeof l.lng === "number");
  RecoMap.setLeafletMarkers(mapInstance, list, (item) => {
    selectedListingId = item.id;
    const card = resultContainer.querySelector(`.card[data-id="${CSS.escape(item.id)}"]`);
    resultContainer.querySelectorAll(".card").forEach((c) => c.classList.remove("selected-card"));
    if (card) {
      card.classList.add("selected-card");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function runSearch(updateQuery = true) {
  const filters = getFilters();
  const rec = RecoM3ndo.getRecommendations(activeListings, filters);
  currentItems = applySort(enrichDistance(rec.items));
  renderSummary(filters, currentItems, rec.relaxed);
  renderResults(currentItems, rec.relaxed, filters);
  if (updateQuery) setQueryFromFilters(filters);
  refreshMapMarkers();
}

async function initializeListings() {
  const creator = loadJson(STORAGE_KEYS.creatorPack, null);
  if (creator && RecoM3ndo.validateListingPack(creator).valid) { activeListings = creator; dataSource = "Creator local pack"; return; }
  const imported = loadJson(STORAGE_KEYS.packOverride, null);
  if (imported && RecoM3ndo.validateListingPack(imported).valid) { activeListings = imported; dataSource = "Imported pack"; return; }
  try {
    const res = await fetch("data/listings.json", { cache: "no-store" });
    const data = await res.json();
    if (res.ok && RecoM3ndo.validateListingPack(data).valid) { activeListings = data; dataSource = "Default JSON"; return; }
  } catch {
    // fallback
  }
  activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
  dataSource = "Default JSON";
}

function detectDuplicates() {
  const out = [];
  for (let i = 0; i < activeListings.length; i += 1) {
    for (let j = i + 1; j < activeListings.length; j += 1) {
      const a = activeListings[i];
      const b = activeListings[j];
      const same = `${RecoM3ndo.normalize(a.city)}|${RecoM3ndo.normalize(a.name)}` === `${RecoM3ndo.normalize(b.city)}|${RecoM3ndo.normalize(b.name)}`;
      const similar = RecoM3ndo.normalize(a.name).replace(/[^a-z0-9]/g, "") === RecoM3ndo.normalize(b.name).replace(/[^a-z0-9]/g, "");
      if (same || similar) out.push(`${a.name} (${a.city}) ↔ ${b.name} (${b.city})`);
    }
  }
  byId("duplicate-list").innerHTML = out.length ? out.map((d) => `<li>${escapeHtml(d)}</li>`).join("") : "<li>No duplicates detected.</li>";
}

function creatorListingFromForm() {
  const latRaw = byId("creator-lat").value.trim();
  const lngRaw = byId("creator-lng").value.trim();
  const latCheck = latRaw ? RecoGeo.validateCoordinate(latRaw, "lat") : { valid: true, value: undefined };
  const lngCheck = lngRaw ? RecoGeo.validateCoordinate(lngRaw, "lng") : { valid: true, value: undefined };
  if (!latCheck.valid) throw new Error(latCheck.reason);
  if (!lngCheck.valid) throw new Error(lngCheck.reason);
  const listing = {
    id: byId("creator-id").value.trim(),
    name: byId("creator-name").value.trim(),
    city: byId("creator-city").value.trim(),
    category: byId("creator-category").value.trim(),
    budget: byId("creator-budget").value,
    style: byId("creator-style").value,
    description: byId("creator-description").value.trim(),
    tags: byId("creator-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
    verified: byId("creator-verified").checked
  };
  if (byId("creator-address").value.trim()) listing.address = byId("creator-address").value.trim();
  if (byId("creator-phone").value.trim()) listing.phone = byId("creator-phone").value.trim();
  if (byId("creator-url").value.trim()) listing.url = byId("creator-url").value.trim();
  if (latRaw) listing.lat = latCheck.value;
  if (lngRaw) listing.lng = lngCheck.value;
  return listing;
}

function saveCreatorPack() { saveJson(STORAGE_KEYS.creatorPack, activeListings.map(RecoM3ndo.toPackListing)); dataSource = "Creator local pack"; }

function withCreatorValidation(cb) {
  try {
    const listing = creatorListingFromForm();
    const v = RecoM3ndo.validateListingPack([listing]);
    if (!v.valid) return (byId("creator-message").textContent = `Error: ${v.errors[0]}`);
    cb(listing);
    saveCreatorPack();
    detectDuplicates();
    runSearch(false);
    byId("creator-message").textContent = "Saved.";
  } catch (e) {
    byId("creator-message").textContent = `Error: ${e.message}`;
  }
}

function collectDealsParams() {
  return {
    destination: byId("deals-destination").value || byId("destination").value,
    origin: byId("deals-origin").value,
    checkIn: byId("deals-checkin").value,
    checkOut: byId("deals-checkout").value,
    departDate: byId("deals-depart-date").value,
    returnDate: byId("deals-return-date").value,
    adults: Number(byId("deals-adults").value || 1),
    budget: byId("budget").value,
    style: byId("style").value,
    verifiedOnly: byId("verified-only").checked
  };
}

function getDealProviders() { return window.RecoDealProviders || []; }

function loadDealsSettings() {
  return loadJson(STORAGE_KEYS.dealsSettings, {
    proxyEndpoint: "",
    providers: Object.fromEntries(getDealProviders().map((p) => [p.id, { enabled: true, affiliateId: "" }]))
  });
}

function saveDealsSettings(settings) { saveJson(STORAGE_KEYS.dealsSettings, settings); }

function renderDealsSettings() {
  const settings = loadDealsSettings();
  byId("deals-proxy-endpoint").value = settings.proxyEndpoint || "";
  byId("deals-settings").innerHTML = getDealProviders().map((p) => {
    const ps = settings.providers[p.id] || { enabled: true, affiliateId: "" };
    return `<div class="deal-setting-row" data-provider="${p.id}"><label class="checkbox-row"><input class="deal-enabled" type="checkbox" ${ps.enabled ? "checked" : ""}/> ${p.name} enabled</label><input class="deal-affiliate" value="${escapeHtml(ps.affiliateId || "")}" placeholder="affiliateId" /><span class="muted">mode: ${p.modes.join("/")}</span></div>`;
  }).join("");
}

function saveDealsSettingsFromUI() {
  const settings = loadDealsSettings();
  settings.proxyEndpoint = byId("deals-proxy-endpoint").value.trim();
  settings.providers = settings.providers || {};
  byId("deals-settings").querySelectorAll(".deal-setting-row").forEach((row) => {
    const id = row.dataset.provider;
    settings.providers[id] = {
      enabled: row.querySelector(".deal-enabled").checked,
      affiliateId: row.querySelector(".deal-affiliate").value.trim()
    };
  });
  saveDealsSettings(settings);
  return settings;
}

function renderDealsResults(vertical = dealsVertical) {
  dealsVertical = vertical;
  const settings = saveDealsSettingsFromUI();
  const params = collectDealsParams();
  const cards = [];
  getDealProviders().forEach((provider) => {
    const ps = settings.providers[provider.id] || { enabled: true, affiliateId: "" };
    if (!ps.enabled) return;
    const url = provider.buildLink({ ...params, vertical }, { affiliateId: ps.affiliateId });
    cards.push(`<article class="card"><h3>${escapeHtml(provider.name)}</h3><p class="muted">Mode: ${provider.modes.join("/")}${provider.apiNote ? ` · ${escapeHtml(provider.apiNote)}` : ""}</p><div class="actions"><a class="action-link" target="_blank" rel="noopener" href="${url}">Open results</a><button class="secondary save-deal-provider-btn" data-provider="${provider.id}" data-vertical="${vertical}" type="button">Save this search</button></div></article>`);
  });
  byId("deals-results").innerHTML = cards.length ? cards.join("") : '<p class="empty">No enabled providers configured.</p>';
}

function renderSavedDealSearches() {
  const list = dealsStore.list();
  if (!list.length) {
    byId("saved-deal-searches").innerHTML = '<p class="muted">No saved searches yet.</p>';
    return;
  }
  byId("saved-deal-searches").innerHTML = list.map((s) => `<div class="saved-item"><strong>${escapeHtml(s.name)}</strong> <span class="muted">(${escapeHtml(s.providerId)} / ${escapeHtml(s.vertical)})</span> <button class="secondary run-saved-deal-btn" data-id="${s.id}" type="button">Run</button> <button class="secondary delete-saved-deal-btn" data-id="${s.id}" type="button">Delete</button></div>`).join("");
}

function createSearchUrlAndOpen(providerId, vertical, params) {
  const provider = getDealProviders().find((p) => p.id === providerId);
  if (!provider) return;
  const settings = loadDealsSettings();
  const affiliateId = settings.providers?.[providerId]?.affiliateId || "";
  const url = provider.buildLink({ ...params, vertical }, { affiliateId });
  window.open(url, "_blank", "noopener");
}

function renderFreeFinder() {
  const categories = RecoFreeFinder.CATEGORIES || [];
  byId("free-finder-categories").innerHTML = categories.map((c) => `<article class="card"><h3>${escapeHtml(c.title)}</h3><ul>${c.checklist.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul><div class="actions"><button class="secondary free-search-btn" data-cat="${c.id}" type="button">Search near me</button><button class="secondary free-maps-btn" data-cat="${c.id}" type="button">Open in Maps</button><button class="secondary free-save-note-btn" data-cat="${c.id}" type="button">Save resource note</button></div></article>`).join("");
}

function renderResourceNotes(category = "") {
  const notes = notesStore.list(category ? { category } : {});
  byId("resource-notes-list").innerHTML = notes.length
    ? notes.map((n) => `<div class="saved-item"><strong>${escapeHtml(n.title)}</strong> <span class="muted">${escapeHtml(n.category)}</span><p>${escapeHtml(n.note || "")}</p><small>${escapeHtml((n.tags || []).join(", "))}</small></div>`).join("")
    : '<p class="muted">No resource notes yet.</p>';
}

function updateDiagnostics() {
  const byCity = {};
  const byCategory = {};
  activeListings.forEach((l) => {
    byCity[l.city] = (byCity[l.city] || 0) + 1;
    byCategory[l.category] = (byCategory[l.category] || 0) + 1;
  });
  const guard = loadJson(STORAGE_KEYS.guardStatus, null);
  const chars = Object.keys(localStorage).reduce((n, k) => n + k.length + String(localStorage.getItem(k) || "").length, 0);
  byId("diagnostics-content").innerHTML = `<p><strong>App version:</strong> ${APP_VERSION}</p><p><strong>Active data source:</strong> ${escapeHtml(dataSource)}</p><p><strong>Listing counts by city:</strong> ${escapeHtml(JSON.stringify(byCity))}</p><p><strong>Listing counts by category:</strong> ${escapeHtml(JSON.stringify(byCategory))}</p><p><strong>Favorites count:</strong> ${favorites.size}</p><p><strong>LocalStorage estimate:</strong> ${(chars / 1024).toFixed(2)} KB</p><p><strong>Upgrade Guard:</strong> ${guard ? `${guard.pass ? "PASS" : "FAIL"} @ ${guard.timestamp}` : "No run recorded"}</p>`;
  const settings = loadDealsSettings();
  const providers = getDealProviders();
  const enabled = providers.filter((p) => settings.providers?.[p.id]?.enabled !== false).map((p) => `${p.name}:${p.modes.join("/")}`);
  byId("integrations-registry-marker").textContent = `Integrations Registry: enabled providers=${enabled.join(" | ") || "none"}; saved searches=${dealsStore.list().length}; last integration test status=local verify`;
}

function downloadMyData() {
  const payload = {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    activePack: activeListings.map(RecoM3ndo.toPackListing),
    favorites: Array.from(favorites),
    creatorEdits: loadJson(STORAGE_KEYS.creatorPack, []),
    dealSearches: dealsStore.list(),
    freeFinderNotes: notesStore.export()
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  a.download = "recom3ndo-my-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadAssistantSettings() {
  return loadJson(STORAGE_KEYS.assistantSettings, { provider: "ollama", ollamaModel: "llama3.1", baseUrl: "", openaiModel: "", apiKey: "", privacyMode: true });
}
function gatherAssistantSettings() {
  return {
    provider: byId("assistant-provider").value,
    model: byId("assistant-provider").value === "ollama" ? byId("assistant-ollama-model").value : byId("assistant-openai-model").value,
    ollamaModel: byId("assistant-ollama-model").value,
    baseUrl: byId("assistant-base-url").value,
    openaiModel: byId("assistant-openai-model").value,
    apiKey: byId("assistant-api-key").value,
    privacyMode: byId("assistant-privacy-mode").checked
  };
}
function renderAssistantHistory() { byId("assistant-history").innerHTML = assistantMessages.map((m) => `<div class="chat-msg ${m.role}"><strong>${m.role}:</strong> ${escapeHtml(m.content)}</div>`).join(""); saveJson(STORAGE_KEYS.assistantChat, assistantMessages); }
function appendAssistant(role, content) { assistantMessages.push({ role, content, timestamp: new Date().toISOString() }); renderAssistantHistory(); }

async function executeAssistantTool(toolName, args) {
  const filters = getFilters();
  const toolMap = {
    searchListings: () => RecoTools.searchListings(activeListings, args, favorites),
    recommend: () => RecoTools.recommend(activeListings, { preferences: args.preferences || filters }),
    getListingById: () => RecoTools.getListingById(activeListings, args),
    setForm: () => {
      const map = { destination: "destination", category: "category", budget: "budget", style: "style", keyword: "keyword", maxResults: "max-results" };
      Object.entries(map).forEach(([k, id]) => args[k] !== undefined && (byId(id).value = String(args[k])));
      if (args.verifiedOnly !== undefined) byId("verified-only").checked = Boolean(args.verifiedOnly);
      if (args.favoritesOnly !== undefined) byId("favorites-only").checked = Boolean(args.favoritesOnly);
      runSearch(false);
      return { ok: true };
    },
    openListing: () => { openDetailById(args.id); return { ok: true, id: args.id }; },
    buildItinerary: () => RecoTools.buildItinerary(activeListings, args),
    showOnMap: () => {
      mapState = RecoTools.showOnMap(mapState, args);
      byId("map-panel").hidden = false;
      byId("map-show-mode").value = mapState.showMode;
      refreshMapMarkers();
      return mapState;
    },
    navigateTo: () => {
      const res = RecoTools.navigateTo(activeListings, args, userLocation);
      if (res.ok) window.open(res.url, "_blank", "noopener");
      return res;
    },
    openDeals: () => {
      const res = RecoTools.openDeals(getDealProviders(), args);
      if (res.ok) window.open(res.url, "_blank", "noopener");
      return res;
    },
    saveDealSearch: () => RecoTools.saveDealSearch(dealsStore, args),
    listDealSearches: () => RecoTools.listDealSearches(dealsStore),
    buildFreePlan: () => RecoTools.buildFreePlan(args),
    addResourceNote: () => RecoTools.addResourceNote(notesStore, args),
    listResourceNotes: () => RecoTools.listResourceNotes(notesStore, args || {})
  };
  return toolMap[toolName] ? toolMap[toolName]() : { error: `Unknown tool ${toolName}` };
}

async function handleAssistantSend(raw) {
  const message = String(raw || "").trim();
  if (!message) return;
  appendAssistant("user", message);
  const settings = gatherAssistantSettings();
  saveJson(STORAGE_KEYS.assistantSettings, settings);

  const response = await RecoAssistant.runAssistantTurn({
    userMessage: message,
    settings,
    listings: activeListings,
    executeTool: executeAssistantTool,
    currentFilters: getFilters(),
    currentResult: currentItems[0] || null,
    history: assistantMessages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
  });

  appendAssistant("assistant", response.text || "Done.");
}

function bindEvents() {
  form.addEventListener("submit", (e) => { e.preventDefault(); runSearch(true); });
  byId("reset-btn").addEventListener("click", () => { form.reset(); summary.textContent = "Filters reset. Select a destination and search again."; resultContainer.innerHTML = ""; history.replaceState({}, "", location.pathname); });
  resultContainer.addEventListener("click", (e) => {
    const fav = e.target.closest(".favorite-btn");
    if (fav) { favorites.has(fav.dataset.id) ? favorites.delete(fav.dataset.id) : favorites.add(fav.dataset.id); saveFavorites(); runSearch(false); return; }
    const openDetails = e.target.closest(".open-details-btn");
    if (openDetails) { openDetailById(openDetails.dataset.id); focusMarkerById(openDetails.dataset.id); }
  });

  byId("copy-link-btn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); showToast("Link copied"); } catch { showToast("Copy failed"); }
  });

  byId("sort-mode").addEventListener("change", () => runSearch(false));
  byId("use-location-btn").addEventListener("click", () => {
    if (!navigator.geolocation) return showToast("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(({ coords }) => { userLocation = { lat: coords.latitude, lng: coords.longitude }; runSearch(false); refreshMapMarkers(); }, () => showToast("Unable to get location."));
  });

  window.addEventListener("online", () => (byId("offline-banner").hidden = true));
  window.addEventListener("offline", () => (byId("offline-banner").hidden = false));

  byId("data-btn").addEventListener("click", () => byId("data-modal").showModal());
  byId("import-pack-input").addEventListener("change", async (e) => {
    const [file] = e.target.files;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const v = RecoM3ndo.validateListingPack(parsed);
      if (!v.valid) return (byId("data-message").textContent = `Import failed: ${v.errors[0]}`);
      saveJson(STORAGE_KEYS.packOverride, parsed);
      activeListings = parsed;
      dataSource = "Imported pack";
      detectDuplicates();
      runSearch(false);
      byId("data-message").textContent = "Import successful.";
    } catch {
      byId("data-message").textContent = "Import failed: invalid JSON.";
    }
  });
  byId("export-pack-btn").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(activeListings.map(RecoM3ndo.toPackListing), null, 2)], { type: "application/json" }));
    a.download = "recom3ndo-pack.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  byId("reset-pack-btn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.packOverride);
    localStorage.removeItem(STORAGE_KEYS.creatorPack);
    activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
    dataSource = "Default JSON";
    detectDuplicates();
    runSearch(false);
  });

  byId("creator-mode-btn").addEventListener("click", () => {
    creatorModeEnabled = !creatorModeEnabled;
    byId("creator-panel").hidden = !creatorModeEnabled;
    byId("creator-mode-btn").textContent = creatorModeEnabled ? "Disable Creator Mode" : "Enable Creator Mode";
  });

  byId("creator-add-btn").addEventListener("click", () => withCreatorValidation((listing) => {
    if (activeListings.some((l) => l.id === listing.id)) throw new Error("listing id already exists");
    activeListings.push(listing);
  }));
  byId("creator-update-btn").addEventListener("click", () => withCreatorValidation((listing) => {
    const idx = activeListings.findIndex((l) => l.id === listing.id);
    if (idx === -1) throw new Error("id not found for edit");
    activeListings[idx] = listing;
  }));
  byId("creator-delete-btn").addEventListener("click", () => {
    const id = byId("creator-id").value.trim();
    if (!id) return (byId("creator-message").textContent = "Error: id is required for delete.");
    activeListings = activeListings.filter((l) => l.id !== id);
    saveCreatorPack();
    detectDuplicates();
    runSearch(false);
    byId("creator-message").textContent = "Deleted.";
  });
  byId("pick-on-map-btn").addEventListener("click", async () => {
    byId("map-panel").hidden = false;
    await ensureMap();
    RecoMap.setPickLocationMode((latlng) => {
      byId("creator-lat").value = Number(latlng.lat).toFixed(6);
      byId("creator-lng").value = Number(latlng.lng).toFixed(6);
      byId("creator-message").textContent = "Coordinates picked from map.";
      RecoMap.setPickLocationMode(null);
    });
    showToast("Click map to pick coordinates.");
  });

  byId("map-view-btn").addEventListener("click", async () => {
    byId("map-panel").hidden = !byId("map-panel").hidden;
    if (!byId("map-panel").hidden) await refreshMapMarkers();
  });
  byId("map-provider").addEventListener("change", refreshMapMarkers);
  byId("google-maps-key").addEventListener("change", refreshMapMarkers);
  byId("map-show-mode").addEventListener("change", refreshMapMarkers);
  byId("map-center-mode").addEventListener("change", refreshMapMarkers);
  byId("directions-btn").addEventListener("click", () => {
    const item = currentItems.find((i) => i.id === selectedListingId) || currentItems[0];
    if (!item) return showToast("No listing selected.");
    window.open(listingMapUrl(item), "_blank", "noopener");
  });

  byId("deals-nav-btn").addEventListener("click", () => { byId("deals-view").hidden = !byId("deals-view").hidden; renderDealsSettings(); renderDealsResults(dealsVertical); renderSavedDealSearches(); });
  byId("free-finder-nav-btn").addEventListener("click", () => { byId("free-finder-view").hidden = !byId("free-finder-view").hidden; renderFreeFinder(); renderResourceNotes(); });
  document.querySelectorAll(".deals-tab").forEach((btn) => btn.addEventListener("click", () => renderDealsResults(btn.dataset.vertical)));
  byId("deals-run-btn").addEventListener("click", () => renderDealsResults(dealsVertical));
  byId("deals-save-btn").addEventListener("click", () => {
    const name = prompt("Save search name:", `${collectDealsParams().destination || "Trip"} ${dealsVertical}`);
    if (!name) return;
    dealsStore.add({ name, providerId: "multi", vertical: dealsVertical, params: collectDealsParams() });
    saveJson(STORAGE_KEYS.dealsSearches, dealsStore.list());
    renderSavedDealSearches();
  });
  byId("deals-results").addEventListener("click", (e) => {
    const btn = e.target.closest(".save-deal-provider-btn");
    if (!btn) return;
    const name = prompt("Save search name:", `${btn.dataset.provider} ${btn.dataset.vertical}`);
    if (!name) return;
    dealsStore.add({ name, providerId: btn.dataset.provider, vertical: btn.dataset.vertical, params: collectDealsParams() });
    saveJson(STORAGE_KEYS.dealsSearches, dealsStore.list());
    renderSavedDealSearches();
  });
  byId("saved-deal-searches").addEventListener("click", (e) => {
    const runBtn = e.target.closest(".run-saved-deal-btn");
    if (runBtn) {
      const item = dealsStore.get(runBtn.dataset.id);
      if (item) {
        if (item.providerId === "multi") {
          dealsVertical = item.vertical;
          Object.entries(item.params || {}).forEach(([k, v]) => {
            const id = `deals-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
            if (byId(id)) byId(id).value = v;
          });
          renderDealsResults(item.vertical);
        } else {
          createSearchUrlAndOpen(item.providerId, item.vertical, item.params || {});
        }
      }
      return;
    }
    const delBtn = e.target.closest(".delete-saved-deal-btn");
    if (delBtn) {
      dealsStore.remove(delBtn.dataset.id);
      saveJson(STORAGE_KEYS.dealsSearches, dealsStore.list());
      renderSavedDealSearches();
    }
  });

  byId("free-finder-categories").addEventListener("click", (e) => {
    const cat = e.target.dataset.cat;
    if (!cat) return;
    const destination = byId("destination").value || "near me";
    if (e.target.classList.contains("free-search-btn")) {
      const q = `${cat} free resources ${destination}`;
      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank", "noopener");
    } else if (e.target.classList.contains("free-maps-btn")) {
      const q = `${cat} ${destination}`;
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, "_blank", "noopener");
    } else if (e.target.classList.contains("free-save-note-btn")) {
      const note = prompt("Resource note:", `Check ${cat} options in ${destination}`);
      if (!note) return;
      notesStore.add({ title: `${cat} - ${destination}`, category: cat, note, tags: [destination] });
      saveJson(STORAGE_KEYS.freeNotes, notesStore.export());
      renderResourceNotes();
    }
  });

  byId("free-export-notes-btn").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(notesStore.export(), null, 2)], { type: "application/json" }));
    a.download = "recom3ndo-resource-notes.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  byId("free-import-notes-input").addEventListener("change", async (e) => {
    const [file] = e.target.files;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      notesStore.import(Array.isArray(parsed) ? parsed : []);
      saveJson(STORAGE_KEYS.freeNotes, notesStore.export());
      renderResourceNotes();
    } catch {
      showToast("Invalid notes JSON");
    }
  });

  byId("diagnostics-btn").addEventListener("click", () => { updateDiagnostics(); byId("diagnostics-modal").showModal(); });
  byId("clear-local-data-btn").addEventListener("click", () => {
    if (!confirm("Clear all local RecoM3ndo data?")) return;
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    favorites = new Set();
    saveFavorites();
    activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
    dataSource = "Default JSON";
    detectDuplicates();
    runSearch(false);
    renderSavedDealSearches();
    renderResourceNotes();
    updateDiagnostics();
  });
  byId("download-data-btn").addEventListener("click", downloadMyData);

  byId("assistant-btn").addEventListener("click", () => { byId("assistant-drawer").hidden = false; byId("assistant-input").focus(); });
  byId("assistant-close-btn").addEventListener("click", () => (byId("assistant-drawer").hidden = true));
  byId("assistant-send-btn").addEventListener("click", () => { handleAssistantSend(byId("assistant-input").value); byId("assistant-input").value = ""; });
  byId("assistant-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleAssistantSend(byId("assistant-input").value); byId("assistant-input").value = ""; } });

  byId("qa-recommend-form").addEventListener("click", () => handleAssistantSend("Recommend from my current form"));
  byId("qa-explain-result").addEventListener("click", () => { const top = currentItems[0]; handleAssistantSend(top ? `Explain why ${top.name} is a match` : "Explain this result"); });
  byId("qa-itinerary").addEventListener("click", () => handleAssistantSend("Build a 6-stop itinerary from my selected destination"));
  byId("qa-verified").addEventListener("click", () => handleAssistantSend("Find verified only recommendations"));
  byId("qa-show-map").addEventListener("click", () => handleAssistantSend("Show results on map"));
  byId("qa-navigate-top").addEventListener("click", () => handleAssistantSend("Navigate to top pick"));
  byId("qa-find-hotel-deals").addEventListener("click", () => handleAssistantSend("Find hotel deals"));
  byId("qa-find-flight-deals").addEventListener("click", () => handleAssistantSend("Find flight deals"));
  byId("qa-cheapest-links").addEventListener("click", () => handleAssistantSend("Show cheapest link options and explain limitations"));

  byId("assistant-clear-btn").addEventListener("click", () => { assistantMessages = []; renderAssistantHistory(); });
  byId("assistant-export-btn").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(assistantMessages, null, 2)], { type: "application/json" }));
    a.download = "recom3ndo-chat.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

async function init() {
  registerServiceWorker();
  byId("install-hint").textContent = "Tip: install this app for offline Traveler Companion mode.";
  byId("offline-banner").hidden = navigator.onLine;

  loadFavorites();
  const mapSettings = loadJson(STORAGE_KEYS.mapSettings, null);
  if (mapSettings) {
    byId("map-provider").value = mapSettings.provider || "leaflet";
    byId("google-maps-key").value = mapSettings.googleKey || "";
  }

  const assistantSettings = loadAssistantSettings();
  byId("assistant-provider").value = assistantSettings.provider;
  byId("assistant-ollama-model").value = assistantSettings.ollamaModel;
  byId("assistant-base-url").value = assistantSettings.baseUrl;
  byId("assistant-openai-model").value = assistantSettings.openaiModel;
  byId("assistant-api-key").value = assistantSettings.apiKey;
  byId("assistant-privacy-mode").checked = assistantSettings.privacyMode !== false;

  assistantMessages = loadJson(STORAGE_KEYS.assistantChat, []);
  renderAssistantHistory();

  dealsStore.import?.(loadJson(STORAGE_KEYS.dealsSearches, []));
  notesStore.import(loadJson(STORAGE_KEYS.freeNotes, []));

  bindEvents();
  await initializeListings();
  detectDuplicates();
  renderDealsSettings();
  renderSavedDealSearches();
  renderFreeFinder();
  renderResourceNotes();

  const route = RecoM3ndo.parseRouteState(location.search);
  byId("destination").value = route.filters.destination;
  byId("category").value = route.filters.category;
  byId("budget").value = route.filters.budget;
  byId("style").value = route.filters.style;
  byId("keyword").value = route.filters.keyword;
  byId("max-results").value = String(route.filters.maxResults);
  byId("verified-only").checked = route.filters.verifiedOnly;
  byId("favorites-only").checked = route.filters.favoritesOnly;

  if (route.detailId) openDetailById(route.detailId);
  else if (location.search) runSearch(false);
  else summary.textContent = "Choose a destination and submit to get started.";

  setGuardStatus(true);
}

init();
