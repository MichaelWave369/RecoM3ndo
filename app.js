const APP_VERSION = "0.7.0";
const STORAGE_KEYS = {
  favorites: "recom3ndo_favorites_v1",
  packOverride: "recom3ndo_pack_override_v1",
  creatorPack: "recom3ndo_creator_pack_v1",
  guardStatus: "recom3ndo_guard_status_v1",
  assistantSettings: "recom3ndo_assistant_settings_v1",
  assistantChat: "recom3ndo_assistant_chat_v1",
  mapSettings: "recom3ndo_map_settings_v1"
};

const byId = (id) => document.getElementById(id);
const form = byId("recommendation-form");
const resultContainer = byId("results");
const summary = byId("result-summary");
const template = byId("card-template");
const detailView = byId("detail-view");

let activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
let dataSource = "Default JSON";
let favorites = new Set();
let userLocation = null;
let currentItems = [];
let selectedListingId = null;
let assistantMessages = [];
let mapState = { visible: false, showMode: "results", centerMode: "top", selectedId: null, provider: "leaflet", googleKey: "" };
let mapInstance = null;
let creatorModeEnabled = false;

function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || ""); } catch { return fallback; }
}

function escapeHtml(v) {
  return String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 1600);
}

function setGuardStatus(pass) { saveJson(STORAGE_KEYS.guardStatus, { pass, timestamp: new Date().toISOString() }); }

function registerServiceWorker() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => null);
}

function loadFavorites() {
  const arr = loadJson(STORAGE_KEYS.favorites, []);
  favorites = new Set(Array.isArray(arr) ? arr : []);
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

function applySort(items) {
  const mode = byId("sort-mode").value;
  const sorted = [...items];
  if (mode === "verified") {
    sorted.sort((a, b) => Number(b.verified) - Number(a.verified) || b.score - a.score);
  } else if (mode === "nearest" && userLocation) {
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

function listingActionsHtml(item) {
  const actions = [];
  const mapUrl = RecoGeo.mapUrlForListing(item, userLocation);
  if (mapUrl) actions.push(`<a class="action-link" target="_blank" rel="noopener" href="${mapUrl}">Open in Maps</a>`);
  if (item.phone) actions.push(`<a class="action-link" href="tel:${escapeHtml(item.phone)}">Call</a>`);
  if (item.url) actions.push(`<a class="action-link" target="_blank" rel="noopener" href="${escapeHtml(item.url)}">Website</a>`);
  actions.push(`<button type="button" class="secondary open-details-btn" data-id="${escapeHtml(item.id)}">Open details</button>`);
  return actions.join("");
}

function openDetailById(id) {
  const listing = activeListings.find((l) => l.id === id) || currentItems.find((l) => l.id === id);
  if (!listing) return;
  selectedListingId = id;
  detailView.innerHTML = `
    <article class="detail-card">
      <button id="back-to-results" type="button" class="secondary">Back to results</button>
      <h2>${escapeHtml(listing.name)}</h2>
      <p class="meta">${escapeHtml(listing.city)} · ${escapeHtml(listing.category)} · ${escapeHtml(listing.budget)} budget${listing.verified ? " · verified" : ""}</p>
      <p>${escapeHtml(listing.description)}</p>
      <p>${escapeHtml(listing.address || "Address unavailable")}</p>
      <p>${escapeHtml(listing.phone || "Phone unavailable")}</p>
      <div class="actions">${listingActionsHtml(listing)}</div>
      <ul>${(listing.tags || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
    </article>
  `;
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

function highlightCard(id) {
  resultContainer.querySelectorAll(".card").forEach((card) => card.classList.toggle("selected-card", card.dataset.id === id));
  const card = resultContainer.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderResults(items, relaxed, filters) {
  detailView.hidden = true;
  resultContainer.hidden = false;
  summary.hidden = false;
  resultContainer.innerHTML = "";

  if (filters.favoritesOnly && favorites.size === 0) {
    resultContainer.innerHTML = '<p class="empty">Favorites-only is on but no favorites are saved yet.</p>';
    return;
  }

  if (!items.length) {
    resultContainer.innerHTML = '<p class="empty">No direct matches found. Try broadening filters.</p>';
    return;
  }

  items.forEach((item, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = item.id;
    card.querySelector(".name").textContent = item.name;
    card.querySelector(".score").textContent = `${item.score} pts`;
    const distance = typeof item.distanceMiles === "number" ? ` · ${item.distanceMiles.toFixed(1)} mi` : "";
    card.querySelector(".meta").textContent = `${item.city} · ${item.category} · ${item.budget} budget${item.verified ? " · verified" : ""}${distance}`;
    card.querySelector(".description").textContent = item.description;

    const favBtn = card.querySelector(".favorite-btn");
    favBtn.dataset.id = item.id;
    favBtn.textContent = favorites.has(item.id) ? "★" : "☆";
    favBtn.classList.toggle("active", favorites.has(item.id));

    const tags = card.querySelector(".tags");
    const stateLi = document.createElement("li");
    stateLi.textContent = index === 0 ? "Top match" : relaxed ? "Alternative match" : "Recommended";
    tags.appendChild(stateLi);
    (item.tags || []).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      tags.appendChild(li);
    });

    const why = card.querySelector(".why-list");
    (item.explanation || []).forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      why.appendChild(li);
    });

    card.querySelector(".card-actions").innerHTML = listingActionsHtml(item);
    card.querySelector(".name").addEventListener("click", () => {
      selectedListingId = item.id;
      openDetailById(item.id);
      if (mapState.visible) focusMarkerById(item.id);
    });

    resultContainer.appendChild(card);
  });
}

function renderSummary(filters, items, relaxed) {
  if (!filters.destination) {
    summary.textContent = "Choose a destination and submit to get started.";
    return;
  }
  if (!items.length) {
    summary.textContent = `No results found in ${filters.destination}.`;
    return;
  }
  summary.textContent = `${relaxed ? "Relaxed" : "Exact"} match: ${items.length} result(s) for ${filters.destination}.`;
}

function getMapListings() {
  const showMode = byId("map-show-mode").value;
  if (showMode === "favorites") {
    return activeListings.filter((l) => favorites.has(l.id));
  }
  if (showMode === "city") {
    const city = byId("destination").value;
    return activeListings.filter((l) => !city || l.city === city);
  }
  return currentItems;
}

function centerMap(listings) {
  if (!mapInstance || !listings.length) return;
  const centerMode = byId("map-center-mode").value;
  if (centerMode === "user" && userLocation && mapInstance.setView) {
    mapInstance.setView([userLocation.lat, userLocation.lng], 12);
    return;
  }
  if (centerMode === "city") {
    const target = listings.find((l) => typeof l.lat === "number" && typeof l.lng === "number");
    if (target && mapInstance.setView) mapInstance.setView([target.lat, target.lng], 11);
    return;
  }
  const top = listings.find((l) => typeof l.lat === "number" && typeof l.lng === "number");
  if (top && mapInstance.setView) mapInstance.setView([top.lat, top.lng], 13);
}

async function ensureMap() {
  const provider = byId("map-provider").value;
  mapState.provider = provider;
  mapState.googleKey = byId("google-maps-key").value.trim();
  saveJson(STORAGE_KEYS.mapSettings, { provider: mapState.provider, googleKey: mapState.googleKey });

  if (provider === "google" && mapState.googleKey) {
    try {
      mapInstance = await RecoMap.initGoogleMap("map", mapState.googleKey);
      return;
    } catch (_error) {
      showToast("Google Maps failed; using Leaflet.");
      byId("map-provider").value = "leaflet";
    }
  }

  mapInstance = RecoMap.initLeafletMap("map");
}

function focusMarkerById(id) {
  const listing = activeListings.find((l) => l.id === id) || currentItems.find((l) => l.id === id);
  if (!listing || typeof listing.lat !== "number" || typeof listing.lng !== "number") return;
  RecoMap.focusLeafletMarker(listing);
}

async function refreshMapMarkers() {
  if (!mapState.visible) return;
  await ensureMap();
  const listings = getMapListings().filter((l) => typeof l.lat === "number" && typeof l.lng === "number");
  RecoMap.setLeafletMarkers(mapInstance, listings, (item) => {
    selectedListingId = item.id;
    highlightCard(item.id);
  });
  centerMap(listings);
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
  const creatorPack = loadJson(STORAGE_KEYS.creatorPack, null);
  if (creatorPack && RecoM3ndo.validateListingPack(creatorPack).valid) {
    activeListings = creatorPack;
    dataSource = "Creator local pack";
    return;
  }

  const imported = loadJson(STORAGE_KEYS.packOverride, null);
  if (imported && RecoM3ndo.validateListingPack(imported).valid) {
    activeListings = imported;
    dataSource = "Imported pack";
    return;
  }

  try {
    const response = await fetch("data/listings.json", { cache: "no-store" });
    const data = await response.json();
    if (response.ok && RecoM3ndo.validateListingPack(data).valid) {
      activeListings = data;
      dataSource = "Default JSON";
      return;
    }
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
      const sameCityName = `${RecoM3ndo.normalize(a.city)}|${RecoM3ndo.normalize(a.name)}` === `${RecoM3ndo.normalize(b.city)}|${RecoM3ndo.normalize(b.name)}`;
      const similar = RecoM3ndo.normalize(a.name).replace(/[^a-z0-9]/g, "") === RecoM3ndo.normalize(b.name).replace(/[^a-z0-9]/g, "");
      if (sameCityName || similar) out.push(`${a.name} (${a.city}) ↔ ${b.name} (${b.city})`);
    }
  }
  byId("duplicate-list").innerHTML = out.length ? out.map((d) => `<li>${escapeHtml(d)}</li>`).join("") : "<li>No duplicates detected.</li>";
}

function creatorListingFromForm() {
  const latV = RecoGeo.validateCoordinate(byId("creator-lat").value.trim(), "lat");
  const lngV = RecoGeo.validateCoordinate(byId("creator-lng").value.trim(), "lng");
  if (byId("creator-lat").value.trim() && !latV.valid) throw new Error(latV.reason);
  if (byId("creator-lng").value.trim() && !lngV.valid) throw new Error(lngV.reason);

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
  if (byId("creator-lat").value.trim()) listing.lat = latV.value;
  if (byId("creator-lng").value.trim()) listing.lng = lngV.value;
  return listing;
}

function saveCreatorPack() {
  saveJson(STORAGE_KEYS.creatorPack, activeListings.map(RecoM3ndo.toPackListing));
  dataSource = "Creator local pack";
}

function withCreatorValidation(cb) {
  try {
    const listing = creatorListingFromForm();
    const validation = RecoM3ndo.validateListingPack([listing]);
    if (!validation.valid) {
      byId("creator-message").textContent = `Error: ${validation.errors[0]}`;
      return;
    }
    cb(listing);
    saveCreatorPack();
    detectDuplicates();
    runSearch(false);
    byId("creator-message").textContent = "Saved.";
  } catch (error) {
    byId("creator-message").textContent = `Error: ${error.message}`;
  }
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
  byId("diagnostics-content").innerHTML = `
    <p><strong>App version:</strong> ${APP_VERSION}</p>
    <p><strong>Active data source:</strong> ${escapeHtml(dataSource)}</p>
    <p><strong>Listing counts by city:</strong> ${escapeHtml(JSON.stringify(byCity))}</p>
    <p><strong>Listing counts by category:</strong> ${escapeHtml(JSON.stringify(byCategory))}</p>
    <p><strong>Favorites count:</strong> ${favorites.size}</p>
    <p><strong>LocalStorage estimate:</strong> ${(chars / 1024).toFixed(2)} KB</p>
    <p><strong>Upgrade Guard:</strong> ${guard ? `${guard.pass ? "PASS" : "FAIL"} @ ${guard.timestamp}` : "No run recorded"}</p>
  `;
}

function downloadMyData() {
  const bundle = {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    activePack: activeListings.map(RecoM3ndo.toPackListing),
    favorites: Array.from(favorites),
    creatorEdits: loadJson(STORAGE_KEYS.creatorPack, [])
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
  a.download = "recom3ndo-my-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function openModalWithFocus(dialog, focusEl) {
  const prev = document.activeElement;
  dialog.showModal();
  focusEl?.focus();
  const onClose = () => {
    dialog.removeEventListener("close", onClose);
    prev?.focus();
  };
  dialog.addEventListener("close", onClose);
}

function loadAssistantSettings() {
  return loadJson(STORAGE_KEYS.assistantSettings, {
    provider: "ollama",
    ollamaModel: "llama3.1",
    baseUrl: "",
    openaiModel: "",
    apiKey: "",
    privacyMode: true
  });
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

function renderAssistantHistory() {
  byId("assistant-history").innerHTML = assistantMessages.map((m) => `<div class="chat-msg ${m.role}"><strong>${m.role}:</strong> ${escapeHtml(m.content)}</div>`).join("");
  saveJson(STORAGE_KEYS.assistantChat, assistantMessages);
}

function appendAssistant(role, content) {
  assistantMessages.push({ role, content, timestamp: new Date().toISOString() });
  renderAssistantHistory();
}

async function executeAssistantTool(toolName, args) {
  const filters = getFilters();
  const mapFns = {
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
    openListing: () => {
      openDetailById(args.id);
      return { ok: true, id: args.id };
    },
    buildItinerary: () => RecoTools.buildItinerary(activeListings, args),
    showOnMap: () => {
      mapState = RecoTools.showOnMap(mapState, args);
      byId("map-panel").hidden = false;
      byId("map-show-mode").value = mapState.showMode;
      refreshMapMarkers();
      return mapState;
    },
    navigateTo: () => {
      const nav = RecoTools.navigateTo(activeListings, args, userLocation);
      if (nav.ok) window.open(nav.url, "_blank", "noopener");
      return nav;
    }
  };
  if (!mapFns[toolName]) return { error: `Unknown tool ${toolName}` };
  return mapFns[toolName]();
}

async function handleAssistantSend(input) {
  const message = String(input || "").trim();
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
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(true);
  });

  byId("reset-btn").addEventListener("click", () => {
    form.reset();
    summary.textContent = "Filters reset. Select a destination and search again.";
    resultContainer.innerHTML = "";
    detailView.hidden = true;
    history.replaceState({}, "", location.pathname);
  });

  resultContainer.addEventListener("click", (event) => {
    const fav = event.target.closest(".favorite-btn");
    if (fav) {
      if (favorites.has(fav.dataset.id)) favorites.delete(fav.dataset.id);
      else favorites.add(fav.dataset.id);
      saveFavorites();
      runSearch(false);
      return;
    }
    const openDetails = event.target.closest(".open-details-btn");
    if (openDetails) {
      openDetailById(openDetails.dataset.id);
      focusMarkerById(openDetails.dataset.id);
    }
  });

  byId("copy-link-btn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); showToast("Link copied"); } catch { showToast("Copy failed"); }
  });

  byId("data-btn").addEventListener("click", () => openModalWithFocus(byId("data-modal"), byId("import-pack-input")));
  byId("import-pack-input").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const validation = RecoM3ndo.validateListingPack(parsed);
      if (!validation.valid) {
        byId("data-message").textContent = `Import failed: ${validation.errors[0]}`;
        return;
      }
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

  byId("sort-mode").addEventListener("change", () => runSearch(false));

  byId("use-location-btn").addEventListener("click", () => {
    if (!navigator.geolocation) return showToast("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userLocation = { lat: coords.latitude, lng: coords.longitude };
        runSearch(false);
        refreshMapMarkers();
      },
      () => showToast("Unable to get location.")
    );
  });

  window.addEventListener("online", () => (byId("offline-banner").hidden = true));
  window.addEventListener("offline", () => (byId("offline-banner").hidden = false));

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
    mapState.visible = true;
    await ensureMap();
    RecoMap.setPickLocationMode((latlng) => {
      byId("creator-lat").value = Number(latlng.lat).toFixed(6);
      byId("creator-lng").value = Number(latlng.lng).toFixed(6);
      byId("creator-message").textContent = "Coordinates picked from map.";
      RecoMap.setPickLocationMode(null);
    });
    showToast("Click map to pick coordinates.");
  });

  byId("diagnostics-btn").addEventListener("click", () => {
    updateDiagnostics();
    openModalWithFocus(byId("diagnostics-modal"), byId("download-data-btn"));
  });

  byId("clear-local-data-btn").addEventListener("click", () => {
    if (!confirm("Clear all local RecoM3ndo data?")) return;
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    favorites = new Set();
    saveFavorites();
    activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
    dataSource = "Default JSON";
    detectDuplicates();
    runSearch(false);
    updateDiagnostics();
  });

  byId("download-data-btn").addEventListener("click", downloadMyData);

  byId("map-view-btn").addEventListener("click", async () => {
    mapState.visible = !mapState.visible;
    byId("map-panel").hidden = !mapState.visible;
    if (mapState.visible) await refreshMapMarkers();
  });

  byId("map-provider").addEventListener("change", refreshMapMarkers);
  byId("google-maps-key").addEventListener("change", refreshMapMarkers);
  byId("map-show-mode").addEventListener("change", refreshMapMarkers);
  byId("map-center-mode").addEventListener("change", refreshMapMarkers);

  byId("directions-btn").addEventListener("click", () => {
    const target = currentItems.find((i) => i.id === selectedListingId) || currentItems[0];
    if (!target) return showToast("No listing selected.");
    const url = RecoGeo.mapUrlForListing(target, userLocation);
    if (!url) return showToast("No map destination available.");
    window.open(url, "_blank", "noopener");
  });

  byId("assistant-btn").addEventListener("click", () => {
    byId("assistant-drawer").hidden = false;
    byId("assistant-input").focus();
  });
  byId("assistant-close-btn").addEventListener("click", () => (byId("assistant-drawer").hidden = true));

  byId("assistant-send-btn").addEventListener("click", () => {
    handleAssistantSend(byId("assistant-input").value);
    byId("assistant-input").value = "";
  });
  byId("assistant-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAssistantSend(byId("assistant-input").value);
      byId("assistant-input").value = "";
    }
  });

  byId("qa-recommend-form").addEventListener("click", () => handleAssistantSend("Recommend from my current form"));
  byId("qa-explain-result").addEventListener("click", () => {
    const top = currentItems[0];
    handleAssistantSend(top ? `Explain why ${top.name} is a match` : "Explain this result");
  });
  byId("qa-itinerary").addEventListener("click", () => handleAssistantSend("Build a 6-stop itinerary from my selected destination"));
  byId("qa-verified").addEventListener("click", () => handleAssistantSend("Find verified only recommendations"));
  byId("qa-show-map").addEventListener("click", () => handleAssistantSend("Show results on map"));
  byId("qa-navigate-top").addEventListener("click", () => handleAssistantSend("Navigate to top pick"));

  byId("assistant-clear-btn").addEventListener("click", () => {
    assistantMessages = [];
    renderAssistantHistory();
  });
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

  loadFavorites();
  bindEvents();
  await initializeListings();
  detectDuplicates();

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
