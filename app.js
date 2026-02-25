const form = document.getElementById("recommendation-form");
const resultContainer = document.getElementById("results");
const summary = document.getElementById("result-summary");
const template = document.getElementById("card-template");
const resetButton = document.getElementById("reset-btn");

function toTitle(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderSummary(state) {
  const { filters, items, relaxed } = state;
  if (!filters.destination) {
    summary.textContent = "Choose a destination and submit to get started.";
    return;
  }

  if (items.length === 0) {
    summary.textContent = `No results found in ${filters.destination}. Try another keyword or broaden filters.`;
    return;
  }

  const mode = relaxed ? "Relaxed match" : "Exact match";
  summary.textContent = `${mode}: showing ${items.length} recommendation(s) for ${filters.destination}.`;
}

function renderResults(items, relaxed) {
  resultContainer.innerHTML = "";

  if (items.length === 0) {
    resultContainer.innerHTML =
      '<p class="empty">No direct matches found. Try selecting "Any" budget, clearing keyword search, or switching categories.</p>';
    return;
  }

  items.forEach((item, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".name").textContent = item.name;
    card.querySelector(".score").textContent = `${item.score} pts`;
    card.querySelector(".meta").textContent = `${item.city} · ${toTitle(item.category)} · ${item.budget} budget${item.verified ? " · verified" : ""}`;
    card.querySelector(".description").textContent = item.description;

    const tagList = card.querySelector(".tags");
    const statusTag = document.createElement("li");
    statusTag.textContent = index === 0 ? "Top match" : relaxed ? "Alternative match" : "Recommended";
    tagList.appendChild(statusTag);

    item.tags.forEach((tag) => {
      const li = document.createElement("li");
      li.textContent = tag;
      tagList.appendChild(li);
    });

    resultContainer.appendChild(card);
  });
}

function getFilters() {
  return {
    destination: document.getElementById("destination").value,
    budget: document.getElementById("budget").value,
    category: document.getElementById("category").value,
    style: document.getElementById("style").value,
    keyword: RecoM3ndo.normalize(document.getElementById("keyword").value),
    maxResults: Number(document.getElementById("max-results").value),
    verifiedOnly: document.getElementById("verified-only").checked
  };
}

function runSearch() {
  const filters = getFilters();
  const { items, relaxed } = RecoM3ndo.getRecommendations(filters);
  renderSummary({ filters, items, relaxed });
  renderResults(items, relaxed);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

resetButton.addEventListener("click", () => {
  form.reset();
  summary.textContent = "Filters reset. Select a destination and search again.";
  resultContainer.innerHTML = "";
});

summary.textContent = "Choose a destination and submit to get started.";
