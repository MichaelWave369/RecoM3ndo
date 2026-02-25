const assert = require("assert");
const { getRecommendations, normalize } = require("./recommender.js");

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

assert.equal(normalize("  SHUTTLE "), "shuttle", "Normalize should trim and lowercase values");

console.log("All tests passed");
