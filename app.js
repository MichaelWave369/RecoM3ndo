const STORAGE_KEYS = {
  favorites: "recom3ndo_favorites_v1",
  packOverride: "recom3ndo_pack_override_v1"
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

let activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
let favorites = loadFavorites();
let userLocation = null;
let currentItems = [];

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/service-worker.js").catch(() => null);
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
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  if (listing.phone) actions.push(`<a class="action-link" href="tel:${listing.phone}">Call</a>`);
  if (listing.url) actions.push(`<a class="action-link" href="${listing.url}" target="_blank" rel="noopener">Website</a>`);

  detailView.innerHTML = `
    <article class="detail-card">
      <button id="back-to-results" class="secondary" type="button">Back to results</button>
      <h2>${listing.name}</h2>
      <p class="meta">${listing.city} · ${toTitle(listing.category)} · ${listing.budget} budget${listing.verified ? " · verified" : ""}</p>
      <p>${listing.description}</p>
      <p>${listing.address || "Address unavailable"}</p>
      <p>${listing.phone || "Phone unavailable"}</p>
      <div class="actions">${actions.join("")}</div>
      <ul>${(listing.tags || []).map((tag) => `<li>${tag}</li>`).join("")}</ul>
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
    next.sort((a, b) => Number(b.verified) - Number(a.verified) || b.score - a.score);
    return next;
  }

  if (mode === "nearest" && userLocation) {
    next.sort((a, b) => {
      const da = typeof a.distanceMiles === "number" ? a.distanceMiles : Number.POSITIVE_INFINITY;
      const db = typeof b.distanceMiles === "number" ? b.distanceMiles : Number.POSITIVE_INFINITY;
      return da - db || b.score - a.score;
    });
    return next;
  }

  return next;
}

function enrichWithDistance(items) {
  return items.map((item) => {
    if (userLocation && typeof item.lat === "number" && typeof item.lng === "number") {
      const distanceMiles = RecoM3ndo.haversineMiles(userLocation, { lat: item.lat, lng: item.lng });
      return { ...item, distanceMiles };
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
    card.querySelector(".name").textContent = item.name;
    card.querySelector(".name").addEventListener("click", () => {
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
    if (item.phone) actions.insertAdjacentHTML("beforeend", `<a class="action-link" href="tel:${item.phone}">Call</a>`);
    if (item.url) actions.insertAdjacentHTML("beforeend", `<a class="action-link" target="_blank" rel="noopener" href="${item.url}">Website</a>`);

    resultContainer.appendChild(card);
  });
}

function runSearch(updateQuery = true) {
  const filters = getFilters();
  const rec = RecoM3ndo.getRecommendations(activeListings, filters);
  const enriched = enrichWithDistance(rec.items);
  currentItems = applySort(enriched);
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
    dataMessage.textContent = "Import successful.";
    runSearch(false);
  } catch (_error) {
    dataMessage.textContent = "Import failed: invalid JSON.";
  }
}

function exportPack() {
  const payload = activeListings.map(RecoM3ndo.toPackListing);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "recom3ndo-pack.json";
  a.click();
  URL.revokeObjectURL(a.href);
  dataMessage.textContent = "Export complete.";
}

function resetPack() {
  localStorage.removeItem(STORAGE_KEYS.packOverride);
  activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
  dataMessage.textContent = "Reset complete.";
  runSearch(false);
}

async function initializeListings() {
  const override = localStorage.getItem(STORAGE_KEYS.packOverride);
  if (override) {
    try {
      const parsed = JSON.parse(override);
      if (RecoM3ndo.validateListingPack(parsed).valid) {
        activeListings = parsed;
        return;
      }
    } catch (_error) {}
  }

  try {
    const res = await fetch("data/listings.json", { cache: "no-store" });
    if (!res.ok) throw new Error("fetch");
    const parsed = await res.json();
    if (RecoM3ndo.validateListingPack(parsed).valid) {
      activeListings = parsed;
      return;
    }
  } catch (_error) {}

  activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
}

function setupModalA11y() {
  let lastFocus = null;
  dataButton.addEventListener("click", () => {
    lastFocus = document.activeElement;
    dataMessage.textContent = "";
    dataModal.showModal();
    importPackInput.focus();
  });

  dataModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dataModal.close();
    if (event.key !== "Tab") return;
    const nodes = Array.from(dataModal.querySelectorAll("button, input, [href], select, textarea")).filter((el) => !el.disabled);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  dataModal.addEventListener("close", () => {
    if (lastFocus) lastFocus.focus();
  });
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
    await navigator.clipboard.writeText(window.location.href);
    showToast("Link copied");
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
        showToast("Location enabled for nearest sort.");
        runSearch(false);
      },
      () => showToast("Unable to get your location.")
    );
  });

  window.addEventListener("online", () => (offlineBanner.hidden = true));
  window.addEventListener("offline", () => (offlineBanner.hidden = false));
}

async function init() {
  registerServiceWorker();
  saveFavorites();
  installHint.textContent = "Tip: Install this app for offline Traveler Companion mode.";
  setupModalA11y();
  bindEvents();
  offlineBanner.hidden = navigator.onLine;

  await initializeListings();

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
}

init();
