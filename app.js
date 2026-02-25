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

let activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
let favorites = loadFavorites();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 1600);
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

  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", url);
}

function applyQueryToForm() {
  const params = new URLSearchParams(window.location.search);
  const get = (k) => params.get(k);

  const fieldMap = {
    destination: "destination",
    category: "category",
    budget: "budget",
    style: "style",
    keyword: "keyword"
  };

  Object.entries(fieldMap).forEach(([queryKey, elementId]) => {
    const value = get(queryKey);
    if (value !== null) document.getElementById(elementId).value = value;
  });

  if (get("max")) document.getElementById("max-results").value = get("max");
  document.getElementById("verified-only").checked = get("verifiedOnly") === "1";
  document.getElementById("favorites-only").checked = get("favoritesOnly") === "1";

  return params.toString().length > 0;
}

function renderSummary(filters, items, relaxed) {
  if (!filters.destination) {
    summary.textContent = "Choose a destination and submit to get started.";
    return;
  }

  if (filters.favoritesOnly && favorites.size === 0) {
    summary.textContent = "Favorites-only is enabled, but you have no favorites yet. Star a few listings first.";
    return;
  }

  if (items.length === 0) {
    summary.textContent = `No results found in ${filters.destination}. Try another keyword or broaden filters.`;
    return;
  }

  summary.textContent = `${relaxed ? "Relaxed" : "Exact"} match: showing ${items.length} recommendation(s) for ${filters.destination}.`;
}

function renderResults(items, relaxed, filters) {
  resultContainer.innerHTML = "";

  if (filters.favoritesOnly && favorites.size === 0) {
    resultContainer.innerHTML = `<p class="empty">You turned on Favorites-only, but no favorites exist yet. Click ☆ on any card to save one.</p>`;
    return;
  }

  if (items.length === 0) {
    resultContainer.innerHTML = `<p class="empty">No direct matches found. Try selecting "Any" budget, clearing keyword search, or switching categories.</p>`;
    return;
  }

  items.forEach((item, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".name").textContent = item.name;
    card.querySelector(".score").textContent = `${item.score} pts`;
    card.querySelector(".meta").textContent = `${item.city} · ${toTitle(item.category)} · ${item.budget} budget${item.verified ? " · verified" : ""}`;
    card.querySelector(".description").textContent = item.description;

    const favoriteButton = card.querySelector(".favorite-btn");
    favoriteButton.dataset.id = item.id;
    favoriteButton.textContent = favorites.has(item.id) ? "★" : "☆";
    favoriteButton.classList.toggle("active", favorites.has(item.id));

    const tagList = card.querySelector(".tags");
    const statusTag = document.createElement("li");
    statusTag.textContent = index === 0 ? "Top match" : relaxed ? "Alternative match" : "Recommended";
    tagList.appendChild(statusTag);

    item.tags.forEach((tag) => {
      const li = document.createElement("li");
      li.textContent = tag;
      tagList.appendChild(li);
    });

    const whyList = card.querySelector(".why-list");
    (item.explanation || []).forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      whyList.appendChild(li);
    });

    resultContainer.appendChild(card);
  });
}

function runSearch(updateQuery = true) {
  const filters = getFilters();
  const { items, relaxed } = RecoM3ndo.getRecommendations(activeListings, filters);
  renderSummary(filters, items, relaxed);
  renderResults(items, relaxed, filters);
  if (updateQuery) setQueryFromFilters(filters);
}

function handleCardClicks(event) {
  const favoriteButton = event.target.closest(".favorite-btn");
  if (!favoriteButton) return;

  const id = favoriteButton.dataset.id;
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }

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
    const content = await readJsonFile(file);
    const parsed = JSON.parse(content);
    const validation = RecoM3ndo.validateListingPack(parsed);
    if (!validation.valid) {
      dataMessage.textContent = `Import failed: ${validation.errors[0]}`;
      return;
    }

    localStorage.setItem(STORAGE_KEYS.packOverride, JSON.stringify(parsed));
    activeListings = parsed;
    dataMessage.textContent = "Import successful. Using your custom data pack.";
    runSearch(false);
  } catch (_error) {
    dataMessage.textContent = "Import failed: unable to parse JSON file.";
  }
}

function exportPack() {
  const pack = activeListings.map(RecoM3ndo.toPackListing);
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "recom3ndo-pack.json";
  link.click();
  URL.revokeObjectURL(link.href);
  dataMessage.textContent = "Export complete.";
}

function resetPack() {
  localStorage.removeItem(STORAGE_KEYS.packOverride);
  activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
  dataMessage.textContent = "Reset complete. Default listings restored.";
  runSearch(false);
}

async function initializeListings() {
  const override = localStorage.getItem(STORAGE_KEYS.packOverride);
  if (override) {
    try {
      const parsed = JSON.parse(override);
      const validation = RecoM3ndo.validateListingPack(parsed);
      if (validation.valid) {
        activeListings = parsed;
        return;
      }
    } catch (_error) {
      // Ignore invalid override.
    }
  }

  try {
    const response = await fetch("data/listings.json", { cache: "no-store" });
    if (!response.ok) throw new Error("fetch failed");
    const remotePack = await response.json();
    const validation = RecoM3ndo.validateListingPack(remotePack);
    if (validation.valid) {
      activeListings = remotePack;
      return;
    }
  } catch (_error) {
    // Fall through to in-memory defaults.
  }

  activeListings = [...RecoM3ndo.DEFAULT_LISTINGS];
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
    window.history.replaceState({}, "", window.location.pathname);
  });

  resultContainer.addEventListener("click", handleCardClicks);

  copyLinkButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied");
    } catch (_error) {
      showToast("Unable to copy link in this browser.");
    }
  });

  dataButton.addEventListener("click", () => {
    dataMessage.textContent = "";
    dataModal.showModal();
  });

  importPackInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importPack(file);
  });

  exportPackButton.addEventListener("click", exportPack);
  resetPackButton.addEventListener("click", resetPack);
}

async function init() {
  saveFavorites();
  bindEvents();
  await initializeListings();
  const hasQuery = applyQueryToForm();
  if (hasQuery) {
    runSearch(false);
  } else {
    summary.textContent = "Choose a destination and submit to get started.";
  }
}

init();
