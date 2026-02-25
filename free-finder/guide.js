(function (globalScope) {
  const CATEGORIES = [
    { id: "wifi", title: "Free Internet", checklist: ["Check public libraries", "Try community centers", "Look for cafe/public Wi-Fi signs"] },
    { id: "food", title: "Free/Low-cost Food", checklist: ["Search food bank directories", "Check pantry schedules", "Ask local community groups"] },
    { id: "coupons", title: "Coupons/Deals", checklist: ["Check grocery weekly ads", "Use coupon portals", "Compare store loyalty discounts"] },
    { id: "events", title: "Free Things To Do", checklist: ["Check parks and trails", "Look for free museum days", "Search local event calendars"] },
    { id: "essentials", title: "Showers/Restrooms/Charging", checklist: ["Transit hubs", "Libraries/community centers", "24h public facilities"] },
    { id: "assistance", title: "Government assistance / employment", checklist: ["City resource center", "Workforce programs", "Public benefits portals"] }
  ];

  function buildFreePlan({ destination, needs = ["wifi", "food", "coupons", "events"], budget = "any" }) {
    const selected = CATEGORIES.filter((c) => needs.includes(c.id));
    return {
      destination: destination || "any",
      budget,
      generatedAt: new Date().toISOString(),
      steps: selected.map((c) => ({ category: c.id, title: c.title, checklist: c.checklist }))
    };
  }

  const api = { CATEGORIES, buildFreePlan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.RecoFreeFinder = api;
})(typeof window !== "undefined" ? window : globalThis);
