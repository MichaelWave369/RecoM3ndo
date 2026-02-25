const APP_VERSION = "0.4.0";
const STORAGE_KEYS = {
  favorites: "recom3ndo_favorites_v1",
  packOverride: "recom3ndo_pack_override_v1",
  creatorPack: "recom3ndo_creator_pack_v1",
  guardStatus: "recom3ndo_guard_status_v1",
  assistantSettings: "recom3ndo_assistant_settings_v1",
  assistantChat: "recom3ndo_assistant_chat_v1"
};

const form = document.getElementById("recommendation-form");
const resultContainer = document.getElementById("results");
const summary = document.getElementById("result-summary");
const template = document.getElementById("card-template");
const resetButton = document.getElementById("reset-btn");
const favoritesCount = document.getElementById("favorites-count");
const copyLinkButton = document.getElementById("copy-link-btn");
const dataButton = document.getElementById("data-btn");
const dataModal = document.getElementById("data-modal");
const importPackInput = document.getElementById("import-pack-input");
const exportPackButton = document.getElementById("export-pack-btn");
const resetPackButton = document.getElementById("reset-pack-btn");
const dataMessage = document.getElementById("data-message");
const toast = document.getElementById("toast");
const offlineBanner = document.getElementById("offline-banner");
const useLocationButton = document.getElementById("use-location-btn");
const sortMode = document.getElementById("sort-mode");
const detailView = document.getElementById("detail-view");
const installHint = document.getElementById("install-hint");
const creatorModeButton = document.getElementById("creator-mode-btn");
const creatorPanel = document.getElementById("creator-panel");
const creatorMessage = document.getElementById("creator-message");
const duplicateList = document.getElementById("duplicate-list");
const diagnosticsButton = document.getElementById("diagnostics-btn");
const diagnosticsModal = document.getElementById("diagnostics-modal");
const diagnosticsContent = document.getElementById("diagnostics-content");
const clearLocalDataButton = document.getElementById("clear-local-data-btn");
const downloadDataButton = document.getElementById("download-data-btn");
const assistantButton = document.getElementById("assistant-btn");
const assistantDrawer = document.getElementById("assistant-drawer");
const assistantCloseButton = document.getElementById("assistant-close-btn");
const assistantHistory = document.getElementById("assistant-history");
const assistantInput = document.getElementById("assistant-input");
const assistantSendButton = document.getElementById("assistant-send-btn");
const assistantClearButton = document.getElementById("assistant-clear-btn");
const assistantExportButton = document.getElementById("assistant-export-btn");
const assistantProvider = document.getElementById("assistant-provider");
const assistantOllamaModel = document.getElementById("assistant-ollama-model");
const assistantBaseUrl = document.getElementById("assistant-base-url");
const assistantOpenAIModel = document.getElementById("assistant-openai-model");
const assistantApiKey = document.getElementById("assistant-api-key");
const assistantPrivacyMode = document.getElementById("assistant-privacy-mode");

let activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
let dataSource = "Default JSON";
let favorites = loadFavorites();
let userLocation = null;
let currentItems = [];
let creatorModeEnabled = false;
let assistantMessages = [];

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/service-worker.js").catch(() => null);
}

function setGuardStatus(pass) {
  localStorage.setItem(STORAGE_KEYS.guardStatus, JSON.stringify({ pass, timestamp: new Date().toISOString() }));
}

function loadGuardStatus() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.guardStatus) || "null");
  } catch (_error) {
    return null;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 1800);
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.favorites);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_error) {
    return new Set();
  }
}

function saveFavorites() {
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(Array.from(favorites)));
  favoritesCount.textContent = `Favorites: ${favorites.size}`;
}

function toTitle(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getFilters() {
  return {
    destination: document.getElementById("destination").value,
    budget: document.getElementById("budget").value,
    category: document.getElementById("category").value,
    style: document.getElementById("style").value,
    keyword: RecoM3ndo.normalize(document.getElementById("keyword").value),
    maxResults: Number(document.getElementById("max-results").value),
    verifiedOnly: document.getElementById("verified-only").checked,
    favoritesOnly: document.getElementById("favorites-only").checked,
    favoriteIds: favorites
  };
}

function setQueryFromFilters(filters) {
  const params = new URLSearchParams();
  ["destination", "category", "budget", "style", "keyword"].forEach((key) => {
    if (filters[key]) params.set(key, String(filters[key]));
  });
  params.set("max", String(filters.maxResults));
  if (filters.verifiedOnly) params.set("verifiedOnly", "1");
  if (filters.favoritesOnly) params.set("favoritesOnly", "1");
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openDetailById(id) {
  const listing = activeListings.find((item) => item.id === id) || currentItems.find((item) => item.id === id);
  if (!listing) return;

  const actions = [];
  if (listing.address || (typeof listing.lat === "number" && typeof listing.lng === "number")) {
    const mapsUrl = listing.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`
      : `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`;
    actions.push(`<a class="action-link" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>`);
  }
  if (listing.phone) actions.push(`<a class="action-link" href="tel:${escapeHtml(listing.phone)}">Call</a>`);
  if (listing.url) actions.push(`<a class="action-link" href="${escapeHtml(listing.url)}" target="_blank" rel="noopener">Website</a>`);

  detailView.innerHTML = `
    <article class="detail-card">
      <button id="back-to-results" class="secondary" type="button">Back to results</button>
      <h2>${escapeHtml(listing.name)}</h2>
      <p class="meta">${escapeHtml(listing.city)} · ${escapeHtml(toTitle(listing.category))} · ${escapeHtml(listing.budget)} budget${listing.verified ? " · verified" : ""}</p>
      <p>${escapeHtml(listing.description)}</p>
      <p>${escapeHtml(listing.address || "Address unavailable")}</p>
      <p>${escapeHtml(listing.phone || "Phone unavailable")}</p>
      <div class="actions">${actions.join("")}</div>
      <ul>${(listing.tags || []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul>
    </article>
  `;
  detailView.hidden = false;
  resultContainer.hidden = true;
  summary.hidden = true;
  document.getElementById("back-to-results").addEventListener("click", () => {
    detailView.hidden = true;
    resultContainer.hidden = false;
    summary.hidden = false;
    const parsed = RecoM3ndo.parseRouteState(window.location.search);
    setQueryFromFilters({ ...parsed.filters, favoriteIds: favorites });
  });
}

function applySort(items) {
  const mode = sortMode.value;
  const next = [...items];
  if (mode === "verified") {
    return next.sort((a, b) => Number(b.verified) - Number(a.verified) || b.score - a.score);
  }
  if (mode === "nearest" && userLocation) {
    return next.sort((a, b) => {
      const da = typeof a.distanceMiles === "number" ? a.distanceMiles : Number.POSITIVE_INFINITY;
      const db = typeof b.distanceMiles === "number" ? b.distanceMiles : Number.POSITIVE_INFINITY;
      return da - db || b.score - a.score;
    });
  }
  return next;
}

function enrichWithDistance(items) {
  return items.map((item) => {
    if (userLocation && typeof item.lat === "number" && typeof item.lng === "number") {
      return { ...item, distanceMiles: RecoM3ndo.haversineMiles(userLocation, { lat: item.lat, lng: item.lng }) };
    }
    return item;
  });
}

function renderSummary(filters, items, relaxed) {
  if (!filters.destination) {
    summary.textContent = "Choose a destination and submit to get started.";
    return;
  }
  if (filters.favoritesOnly && favorites.size === 0) {
    summary.textContent = "Favorites-only enabled, but no favorites exist yet.";
    return;
  }
  if (items.length === 0) {
    summary.textContent = `No results found in ${filters.destination}.`;
    return;
  }
  summary.textContent = `${relaxed ? "Relaxed" : "Exact"} match: ${items.length} result(s) for ${filters.destination}.`;
}

function renderResults(items, relaxed, filters) {
  resultContainer.innerHTML = "";
  detailView.hidden = true;
  resultContainer.hidden = false;
  summary.hidden = false;

  if (filters.favoritesOnly && favorites.size === 0) {
    resultContainer.innerHTML = `<p class="empty">Favorites-only is on but no favorites are saved yet.</p>`;
    return;
  }

  if (items.length === 0) {
    resultContainer.innerHTML = `<p class="empty">No direct matches found. Try broadening filters.</p>`;
    return;
  }

  items.forEach((item, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const nameNode = card.querySelector(".name");
    nameNode.textContent = item.name;
    nameNode.tabIndex = 0;
    nameNode.addEventListener("click", () => {
      window.history.replaceState({}, "", `${window.location.pathname}?id=${encodeURIComponent(item.id)}`);
      openDetailById(item.id);
    });

    card.querySelector(".score").textContent = `${item.score} pts`;
    const distance = typeof item.distanceMiles === "number" ? ` · ${item.distanceMiles.toFixed(1)} mi` : "";
    card.querySelector(".meta").textContent = `${item.city} · ${toTitle(item.category)} · ${item.budget} budget${item.verified ? " · verified" : ""}${distance}`;
    card.querySelector(".description").textContent = item.description;

    const fav = card.querySelector(".favorite-btn");
    fav.dataset.id = item.id;
    fav.textContent = favorites.has(item.id) ? "★" : "☆";
    fav.classList.toggle("active", favorites.has(item.id));

    const tagList = card.querySelector(".tags");
    const stateTag = document.createElement("li");
    stateTag.textContent = index === 0 ? "Top match" : relaxed ? "Alternative match" : "Recommended";
    tagList.appendChild(stateTag);
    (item.tags || []).forEach((tag) => {
      const li = document.createElement("li");
      li.textContent = tag;
      tagList.appendChild(li);
    });

    const why = card.querySelector(".why-list");
    (item.explanation || []).forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      why.appendChild(li);
    });

    const actions = card.querySelector(".card-actions");
    if (item.address || (typeof item.lat === "number" && typeof item.lng === "number")) {
      const mapsUrl = item.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`
        : `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
      actions.insertAdjacentHTML("beforeend", `<a class="action-link" target="_blank" rel="noopener" href="${mapsUrl}">Open in Maps</a>`);
    }
    if (item.phone) actions.insertAdjacentHTML("beforeend", `<a class="action-link" href="tel:${escapeHtml(item.phone)}">Call</a>`);
    if (item.url) actions.insertAdjacentHTML("beforeend", `<a class="action-link" target="_blank" rel="noopener" href="${escapeHtml(item.url)}">Website</a>`);

    resultContainer.appendChild(card);
  });
}

function runSearch(updateQuery = true) {
  const filters = getFilters();
  const rec = RecoM3ndo.getRecommendations(activeListings, filters);
  currentItems = applySort(enrichWithDistance(rec.items));
  renderSummary(filters, currentItems, rec.relaxed);
  renderResults(currentItems, rec.relaxed, filters);
  if (updateQuery) setQueryFromFilters(filters);
}

function handleCardClicks(event) {
  const button = event.target.closest(".favorite-btn");
  if (!button) return;
  const id = button.dataset.id;
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFavorites();
  runSearch(false);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function importPack(file) {
  try {
    const parsed = JSON.parse(await readJsonFile(file));
    const validation = RecoM3ndo.validateListingPack(parsed);
    if (!validation.valid) {
      dataMessage.textContent = `Import failed: ${validation.errors[0]}`;
      return;
    }
    localStorage.setItem(STORAGE_KEYS.packOverride, JSON.stringify(parsed));
    activeListings = parsed;
    dataSource = "Imported pack";
    dataMessage.textContent = "Import successful.";
    detectDuplicates();
    runSearch(false);
  } catch (_error) {
    dataMessage.textContent = "Import failed: invalid JSON.";
  }
}

function exportPack() {
  const payload = activeListings.map(RecoM3ndo.toPackListing);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  a.download = "recom3ndo-pack.json";
  a.click();
  URL.revokeObjectURL(a.href);
  dataMessage.textContent = "Export complete.";
}

function resetPack() {
  localStorage.removeItem(STORAGE_KEYS.packOverride);
  localStorage.removeItem(STORAGE_KEYS.creatorPack);
  activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
  dataSource = "Default JSON";
  dataMessage.textContent = "Reset complete.";
  detectDuplicates();
  runSearch(false);
}

function normalizeName(value) {
  return RecoM3ndo.normalize(value).replace(/[^a-z0-9]/g, "");
}

function detectDuplicates() {
  const collisions = [];
  for (let i = 0; i < activeListings.length; i += 1) {
    for (let j = i + 1; j < activeListings.length; j += 1) {
      const a = activeListings[i];
      const b = activeListings[j];
      if (`${RecoM3ndo.normalize(a.city)}|${RecoM3ndo.normalize(a.name)}` === `${RecoM3ndo.normalize(b.city)}|${RecoM3ndo.normalize(b.name)}` || normalizeName(a.name) === normalizeName(b.name)) {
        collisions.push(`${a.name} (${a.city}) ↔ ${b.name} (${b.city})`);
      }
    }
  }
  duplicateList.innerHTML = collisions.length ? collisions.map((d) => `<li>${escapeHtml(d)}</li>`).join("") : "<li>No duplicates detected.</li>";
}

function creatorListingFromForm() {
  const listing = {
    id: document.getElementById("creator-id").value.trim(),
    name: document.getElementById("creator-name").value.trim(),
    city: document.getElementById("creator-city").value.trim(),
    category: document.getElementById("creator-category").value.trim(),
    budget: document.getElementById("creator-budget").value,
    style: document.getElementById("creator-style").value,
    description: document.getElementById("creator-description").value.trim(),
    tags: document.getElementById("creator-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
    verified: document.getElementById("creator-verified").checked
  };

  const optional = {
    address: document.getElementById("creator-address").value.trim(),
    phone: document.getElementById("creator-phone").value.trim(),
    url: document.getElementById("creator-url").value.trim(),
    lat: document.getElementById("creator-lat").value.trim(),
    lng: document.getElementById("creator-lng").value.trim()
  };

  if (optional.address) listing.address = optional.address;
  if (optional.phone) listing.phone = optional.phone;
  if (optional.url) listing.url = optional.url;
  if (optional.lat) listing.lat = Number(optional.lat);
  if (optional.lng) listing.lng = Number(optional.lng);
  return listing;
}

function saveCreatorPack() {
  localStorage.setItem(STORAGE_KEYS.creatorPack, JSON.stringify(activeListings.map(RecoM3ndo.toPackListing)));
  dataSource = "Creator local pack";
}

function withCreatorValidation(cb) {
  const listing = creatorListingFromForm();
  const validation = RecoM3ndo.validateListingPack([listing]);
  if (!validation.valid) {
    creatorMessage.textContent = `Error: ${validation.errors[0]}`;
    return;
  }
  cb(listing);
  detectDuplicates();
  saveCreatorPack();
  creatorMessage.textContent = "Saved.";
  runSearch(false);
}

function updateDiagnostics() {
  const cityCounts = {};
  const categoryCounts = {};
  activeListings.forEach((item) => {
    cityCounts[item.city] = (cityCounts[item.city] || 0) + 1;
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });

  const guard = loadGuardStatus();
  const totalStorageChars = Object.keys(localStorage).reduce((acc, key) => acc + key.length + String(localStorage.getItem(key) || "").length, 0);
  diagnosticsContent.innerHTML = `
    <p><strong>App version:</strong> ${APP_VERSION}</p>
    <p><strong>Active data source:</strong> ${escapeHtml(dataSource)}</p>
    <p><strong>Favorites count:</strong> ${favorites.size}</p>
    <p><strong>LocalStorage estimate:</strong> ${(totalStorageChars / 1024).toFixed(2)} KB</p>
    <p><strong>Cities:</strong> ${escapeHtml(JSON.stringify(cityCounts))}</p>
    <p><strong>Categories:</strong> ${escapeHtml(JSON.stringify(categoryCounts))}</p>
    <p><strong>Upgrade Guard:</strong> ${guard ? `${guard.pass ? "PASS" : "FAIL"} @ ${guard.timestamp}` : "No run recorded"}</p>
  `;
}

function downloadMyData() {
  const bundle = {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    activePack: activeListings.map(RecoM3ndo.toPackListing),
    favorites: Array.from(favorites),
    creatorEdits: JSON.parse(localStorage.getItem(STORAGE_KEYS.creatorPack) || "[]")
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
  a.download = "recom3ndo-my-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function initializeListings() {
  const creatorPack = localStorage.getItem(STORAGE_KEYS.creatorPack);
  if (creatorPack) {
    try {
      const parsed = JSON.parse(creatorPack);
      if (RecoM3ndo.validateListingPack(parsed).valid) {
        activeListings = parsed;
        dataSource = "Creator local pack";
        return;
      }
    } catch (_error) {
      // continue
    }
  }

  const override = localStorage.getItem(STORAGE_KEYS.packOverride);
  if (override) {
    try {
      const parsed = JSON.parse(override);
      if (RecoM3ndo.validateListingPack(parsed).valid) {
        activeListings = parsed;
        dataSource = "Imported pack";
        return;
      }
    } catch (_error) {
      // continue
    }
  }

  try {
    const res = await fetch("data/listings.json", { cache: "no-store" });
    if (!res.ok) throw new Error("fetch");
    const parsed = await res.json();
    if (RecoM3ndo.validateListingPack(parsed).valid) {
      activeListings = parsed;
      dataSource = "Default JSON";
      return;
    }
  } catch (_error) {
    // fallback
  }

  activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
  dataSource = "Default JSON";
}

function trapFocus(dialog, firstSelector) {
  let previousFocus = null;
  dialog.addEventListener("close", () => {
    if (previousFocus) previousFocus.focus();
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dialog.close();
    if (event.key !== "Tab") return;
    const focusables = Array.from(dialog.querySelectorAll("button, input, select, textarea, [href]")).filter((el) => !el.disabled);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  return () => {
    previousFocus = document.activeElement;
    dialog.showModal();
    dialog.querySelector(firstSelector)?.focus();
  };
}


function loadAssistantSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.assistantSettings) || "null") || {
      provider: "ollama",
      ollamaModel: "llama3.1",
      baseUrl: "",
      openaiModel: "",
      apiKey: "",
      privacyMode: true
    };
  } catch (_error) {
    return { provider: "ollama", ollamaModel: "llama3.1", baseUrl: "", openaiModel: "", apiKey: "", privacyMode: true };
  }
}

function saveAssistantSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.assistantSettings, JSON.stringify(settings));
}

function renderAssistantHistory() {
  assistantHistory.innerHTML = assistantMessages
    .map((m) => `<div class="chat-msg ${m.role}"><strong>${m.role}:</strong> ${escapeHtml(m.content)}</div>`)
    .join("");
  assistantHistory.scrollTop = assistantHistory.scrollHeight;
  localStorage.setItem(STORAGE_KEYS.assistantChat, JSON.stringify(assistantMessages));
}

function appendAssistantMessage(role, content) {
  assistantMessages.push({ role, content, timestamp: new Date().toISOString() });
  renderAssistantHistory();
}

function gatherAssistantSettings() {
  return {
    provider: assistantProvider.value,
    model: assistantProvider.value === "ollama" ? assistantOllamaModel.value : assistantOpenAIModel.value,
    ollamaModel: assistantOllamaModel.value,
    baseUrl: assistantBaseUrl.value,
    openaiModel: assistantOpenAIModel.value,
    apiKey: assistantApiKey.value,
    privacyMode: assistantPrivacyMode.checked
  };
}

async function executeAssistantTool(toolName, args) {
  const filters = getFilters();
  const favoriteIds = favorites;
  const toolMap = {
    searchListings: () => RecoTools.searchListings(activeListings, args, favoriteIds),
    recommend: () => RecoTools.recommend(activeListings, { preferences: args.preferences || filters }),
    getListingById: () => RecoTools.getListingById(activeListings, args),
    setForm: () => {
      const map = { destination: "destination", category: "category", budget: "budget", style: "style", keyword: "keyword", maxResults: "max-results" };
      Object.entries(map).forEach(([key, id]) => {
        if (args[key] !== undefined && document.getElementById(id)) document.getElementById(id).value = String(args[key]);
      });
      if (args.verifiedOnly !== undefined) document.getElementById("verified-only").checked = Boolean(args.verifiedOnly);
      if (args.favoritesOnly !== undefined) document.getElementById("favorites-only").checked = Boolean(args.favoritesOnly);
      runSearch(false);
      return { ok: true };
    },
    openListing: () => {
      if (!args.id) return { ok: false, error: "id missing" };
      window.history.replaceState({}, "", `${window.location.pathname}?id=${encodeURIComponent(args.id)}`);
      openDetailById(args.id);
      return { ok: true, id: args.id };
    },
    buildItinerary: () => RecoTools.buildItinerary(activeListings, args)
  };

  if (!toolMap[toolName]) return { error: `Unknown tool: ${toolName}` };
  return toolMap[toolName]();
}

async function handleAssistantSend(message) {
  const text = String(message || "").trim();
  if (!text) return;
  appendAssistantMessage("user", text);

  const settings = gatherAssistantSettings();
  saveAssistantSettings(settings);

  const currentResult = currentItems[0] || null;
  const response = await RecoAssistant.runAssistantTurn({
    userMessage: text,
    settings,
    listings: activeListings,
    executeTool: executeAssistantTool,
    currentFilters: getFilters(),
    currentResult,
    history: assistantMessages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
  });

  appendAssistantMessage("assistant", response.text || "Done.");
}

function bindEvents() {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(true);
  });

  resetButton.addEventListener("click", () => {
    form.reset();
    summary.textContent = "Filters reset. Select a destination and search again.";
    resultContainer.innerHTML = "";
    detailView.hidden = true;
    window.history.replaceState({}, "", window.location.pathname);
  });

  resultContainer.addEventListener("click", handleCardClicks);

  copyLinkButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied");
    } catch (_error) {
      showToast("Copy failed in this browser.");
    }
  });

  const openDataModal = trapFocus(dataModal, "#import-pack-input");
  dataButton.addEventListener("click", () => {
    dataMessage.textContent = "";
    openDataModal();
  });

  const openDiagnosticsModal = trapFocus(diagnosticsModal, "#download-data-btn");
  diagnosticsButton.addEventListener("click", () => {
    updateDiagnostics();
    openDiagnosticsModal();
  });

  importPackInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importPack(file);
  });
  exportPackButton.addEventListener("click", exportPack);
  resetPackButton.addEventListener("click", resetPack);

  sortMode.addEventListener("change", () => runSearch(false));

  useLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        showToast("Location enabled.");
        runSearch(false);
      },
      () => showToast("Unable to get location.")
    );
  });

  window.addEventListener("online", () => (offlineBanner.hidden = true));
  window.addEventListener("offline", () => (offlineBanner.hidden = false));

  creatorModeButton.addEventListener("click", () => {
    creatorModeEnabled = !creatorModeEnabled;
    creatorPanel.hidden = !creatorModeEnabled;
    creatorModeButton.textContent = creatorModeEnabled ? "Disable Creator Mode" : "Enable Creator Mode";
  });

  document.getElementById("creator-add-btn").addEventListener("click", () => {
    withCreatorValidation((listing) => {
      if (activeListings.some((item) => item.id === listing.id)) {
        creatorMessage.textContent = "Error: listing id already exists.";
        return;
      }
      activeListings.push(listing);
    });
  });

  document.getElementById("creator-update-btn").addEventListener("click", () => {
    withCreatorValidation((listing) => {
      const idx = activeListings.findIndex((item) => item.id === listing.id);
      if (idx === -1) {
        creatorMessage.textContent = "Error: id not found for edit.";
        return;
      }
      activeListings[idx] = listing;
    });
  });

  document.getElementById("creator-delete-btn").addEventListener("click", () => {
    const id = document.getElementById("creator-id").value.trim();
    if (!id) {
      creatorMessage.textContent = "Error: id is required for delete.";
      return;
    }
    activeListings = activeListings.filter((item) => item.id !== id);
    saveCreatorPack();
    detectDuplicates();
    runSearch(false);
    creatorMessage.textContent = "Deleted.";
  });

  clearLocalDataButton.addEventListener("click", () => {
    if (!window.confirm("Clear all local RecoM3ndo data?")) return;
    [STORAGE_KEYS.favorites, STORAGE_KEYS.packOverride, STORAGE_KEYS.creatorPack, STORAGE_KEYS.guardStatus].forEach((key) => localStorage.removeItem(key));
    favorites = new Set();
    saveFavorites();
    resetPack();
    updateDiagnostics();
  });

  downloadDataButton.addEventListener("click", downloadMyData);

  assistantButton.addEventListener("click", () => {
    assistantDrawer.hidden = false;
    assistantInput.focus();
  });
  assistantCloseButton.addEventListener("click", () => {
    assistantDrawer.hidden = true;
  });
  assistantSendButton.addEventListener("click", () => {
    handleAssistantSend(assistantInput.value);
    assistantInput.value = "";
  });
  assistantInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAssistantSend(assistantInput.value);
      assistantInput.value = "";
    }
  });

  document.getElementById("qa-recommend-form").addEventListener("click", () => handleAssistantSend("Recommend from my current form"));
  document.getElementById("qa-explain-result").addEventListener("click", () => {
    const top = currentItems[0];
    handleAssistantSend(top ? `Explain why ${top.name} is a match` : "Explain this result");
  });
  document.getElementById("qa-itinerary").addEventListener("click", () => handleAssistantSend("Build a 6-stop itinerary from my selected destination"));
  document.getElementById("qa-verified").addEventListener("click", () => handleAssistantSend("Find verified only recommendations"));

  assistantClearButton.addEventListener("click", () => {
    assistantMessages = [];
    renderAssistantHistory();
  });
  assistantExportButton.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(assistantMessages, null, 2)], { type: "application/json" }));
    a.download = "recom3ndo-chat.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

async function init() {
  registerServiceWorker();
  saveFavorites();
  installHint.textContent = "Tip: install this app for offline Traveler Companion mode.";
  offlineBanner.hidden = navigator.onLine;

  const assistantSettings = loadAssistantSettings();
  assistantProvider.value = assistantSettings.provider || "ollama";
  assistantOllamaModel.value = assistantSettings.ollamaModel || "llama3.1";
  assistantBaseUrl.value = assistantSettings.baseUrl || "";
  assistantOpenAIModel.value = assistantSettings.openaiModel || "";
  assistantApiKey.value = assistantSettings.apiKey || "";
  assistantPrivacyMode.checked = assistantSettings.privacyMode !== false;

  try {
    assistantMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.assistantChat) || "[]");
  } catch (_error) {
    assistantMessages = [];
  }
  renderAssistantHistory();

  bindEvents();
  await initializeListings();
  detectDuplicates();

  const route = RecoM3ndo.parseRouteState(window.location.search);
  document.getElementById("destination").value = route.filters.destination;
  document.getElementById("category").value = route.filters.category;
  document.getElementById("budget").value = route.filters.budget;
  document.getElementById("style").value = route.filters.style;
  document.getElementById("keyword").value = route.filters.keyword;
  document.getElementById("max-results").value = String(route.filters.maxResults);
  document.getElementById("verified-only").checked = route.filters.verifiedOnly;
  document.getElementById("favorites-only").checked = route.filters.favoritesOnly;

  if (route.detailId) {
    openDetailById(route.detailId);
  } else if (window.location.search) {
    runSearch(false);
  } else {
    summary.textContent = "Choose a destination and submit to get started.";
  }

  setGuardStatus(true);
}

init();
