const assert = require("assert");
const { getRecommendations, normalize, validateListingPack, haversineMiles, parseRouteState } = require("./recommender.js");

const exact = getRecommendations({
  destination: "Houston",
  category: "dining",
  budget: "mid",
  style: "family",
  keyword: "kid",
  verifiedOnly: false,
  maxResults: 6
});

assert.equal(exact.relaxed, false, "Expected exact mode for targeted Houston dining search");
assert.ok(exact.items.length >= 1, "Expected at least one exact recommendation");
assert.equal(exact.items[0].name, "Bayou Bites", "Expected Bayou Bites to rank first");

const relaxed = getRecommendations({
  destination: "Houston",
  category: "employment_programs",
  budget: "high",
  style: "family",
  keyword: "",
  verifiedOnly: true,
  maxResults: 6
});

assert.equal(relaxed.relaxed, true, "Expected fallback relaxed mode when strict filters miss");
assert.ok(relaxed.items.some((item) => item.name === "WorkStart Center"), "Expected WorkStart Center in relaxed mode");

const explanation = exact.items[0].explanation.join(" ").toLowerCase();
assert.ok(explanation.includes("city matched"), "Expected explanation to include city match reason");
assert.ok(explanation.includes("keyword matched"), "Expected explanation to include keyword match reason");

const invalidPack = [{
  id: "x1", name: "Bad Item", city: "Houston", category: "dining", budget: "wrong", style: "family", description: "Invalid budget", tags: ["tag"], verified: true
}];
const validation = validateListingPack(invalidPack);
assert.equal(validation.valid, false, "Expected invalid pack to fail validation");
assert.ok(validation.errors[0].includes("budget"), "Expected validation error to mention budget");

const miles = haversineMiles({ lat: 29.7604, lng: -95.3698 }, { lat: 30.2672, lng: -97.7431 });
assert.ok(miles > 140 && miles < 160, `Expected Houston->Austin distance rough range, got ${miles}`);

const routeA = parseRouteState("?destination=Houston&category=hotels&max=9&verifiedOnly=1");
assert.equal(routeA.filters.destination, "Houston");
assert.equal(routeA.filters.category, "hotels");
assert.equal(routeA.filters.maxResults, 9);
assert.equal(routeA.filters.verifiedOnly, true);

const routeB = parseRouteState("?id=hou-workstart-center");
assert.equal(routeB.detailId, "hou-workstart-center", "Expected id route parsing for detail view");

assert.equal(normalize("  SHUTTLE "), "shuttle", "Normalize should trim and lowercase values");

console.log("All tests passed");
