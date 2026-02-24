const listings = [
  {
    name: "Bayou Bites",
    city: "Houston",
    category: "dining",
    budget: "mid",
    styles: ["family", "budget"],
    description: "Local cuisine and vegetarian options near downtown.",
    tags: ["Open late", "Kid menu", "Transit nearby"]
  },
  {
    name: "Capitol Stay Suites",
    city: "Austin",
    category: "hotels",
    budget: "mid",
    styles: ["business", "solo"],
    description: "Work-friendly hotel with co-working lounge and airport shuttle.",
    tags: ["Wi-Fi", "Breakfast", "Airport shuttle"]
  },
  {
    name: "Metro Skills Employment Hub",
    city: "Dallas",
    category: "employment_programs",
    budget: "low",
    styles: ["budget", "solo"],
    description: "Job placement, resume reviews, and free upskilling workshops.",
    tags: ["Career coaching", "No-cost training", "Hiring events"]
  },
  {
    name: "River Walk Performances",
    city: "San Antonio",
    category: "entertainment",
    budget: "low",
    styles: ["family", "solo", "budget"],
    description: "Nightly live music and cultural performances by the river.",
    tags: ["Live music", "Outdoor", "Accessible"]
  },
  {
    name: "Lone Star Home Repair Network",
    city: "Houston",
    category: "contractors",
    budget: "mid",
    styles: ["family", "business"],
    description: "Verified contractors for emergency home and rental repairs.",
    tags: ["Verified licenses", "24/7 support", "Multi-language"]
  },
  {
    name: "City Support Resource Center",
    city: "Austin",
    category: "government_assistance",
    budget: "low",
    styles: ["family", "budget", "solo"],
    description: "Guidance for transit cards, food aid, and temporary housing support.",
    tags: ["Case workers", "Walk-in help", "Document checklist"]
  },
  {
    name: "Convention District Hotel",
    city: "Dallas",
    category: "hotels",
    budget: "high",
    styles: ["business"],
    description: "Premium business lodging close to convention spaces.",
    tags: ["Conference rooms", "Gym", "Lounge"]
  },
  {
    name: "Budget Bistro Loop",
    city: "San Antonio",
    category: "dining",
    budget: "low",
    styles: ["budget", "family"],
    description: "Affordable local meals with quick service and family seating.",
    tags: ["Under $15", "Quick service", "Family tables"]
  }
];

const form = document.getElementById("recommendation-form");
const resultContainer = document.getElementById("results");
const template = document.getElementById("card-template");

function scoreListing(item, filters) {
  let score = 0;

  if (item.city === filters.destination) score += 4;
  if (filters.category === "all" || item.category === filters.category) score += 3;
  if (filters.budget === "any" || item.budget === filters.budget) score += 2;
  if (filters.style === "any" || item.styles.includes(filters.style)) score += 2;

  return score;
}

function getRecommendations(filters) {
  return listings
    .map((item) => ({ ...item, score: scoreListing(item, filters) }))
    .filter((item) => item.city === filters.destination)
    .filter((item) => filters.category === "all" || item.category === filters.category)
    .filter((item) => filters.budget === "any" || item.budget === filters.budget)
    .filter((item) => filters.style === "any" || item.styles.includes(filters.style))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function renderResults(items) {
  resultContainer.innerHTML = "";

  if (items.length === 0) {
    resultContainer.innerHTML =
      '<p class="empty">No direct matches found. Try selecting "Any" budget or another need type.</p>';
    return;
  }

  items.forEach((item) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".name").textContent = item.name;
    card.querySelector(".meta").textContent = `${item.city} · ${item.category.replace("_", " ")} · ${item.budget} budget`;
    card.querySelector(".description").textContent = item.description;

    const tagList = card.querySelector(".tags");
    item.tags.forEach((tag) => {
      const li = document.createElement("li");
      li.textContent = tag;
      tagList.appendChild(li);
    });

    resultContainer.appendChild(card);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const filters = {
    destination: document.getElementById("destination").value,
    budget: document.getElementById("budget").value,
    category: document.getElementById("category").value,
    style: document.getElementById("style").value
  };

  const matches = getRecommendations(filters);
  renderResults(matches);
});

renderResults([]);
