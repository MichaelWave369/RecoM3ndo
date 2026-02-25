const assert = require("assert");
const { getRecommendations, normalize, validateListingPack, haversineMiles, parseRouteState, DEFAULT_LISTINGS } = require("./recommender.js");
const { parseToolCall, searchListings, buildItinerary, buildContext } = require("./tools.js");

const exact = getRecommendations({
  destination: "Houston",
  category: "dining",
  budget: "mid",
  style: "family",
  keyword: "kid",
  verifiedOnly: false,
  maxResults: 6
});
assert.equal(exact.relaxed, false);
assert.ok(exact.items.length >= 1);
assert.equal(exact.items[0].name, "Bayou Bites");

const relaxed = getRecommendations({
  destination: "Houston",
  category: "employment_programs",
  budget: "high",
  style: "family",
  keyword: "",
  verifiedOnly: true,
  maxResults: 6
});
assert.equal(relaxed.relaxed, true);
assert.ok(relaxed.items.some((item) => item.name === "WorkStart Center"));

const explanation = exact.items[0].explanation.join(" ").toLowerCase();
assert.ok(explanation.includes("city matched"));
assert.ok(explanation.includes("keyword matched"));

const invalidPack = [{
  id: "x1", name: "Bad Item", city: "Houston", category: "dining", budget: "wrong", style: "family", description: "Invalid budget", tags: ["tag"], verified: true
}];
const validation = validateListingPack(invalidPack);
assert.equal(validation.valid, false);
assert.ok(validation.errors[0].includes("budget"));

const miles = haversineMiles({ lat: 29.7604, lng: -95.3698 }, { lat: 30.2672, lng: -97.7431 });
assert.ok(miles > 140 && miles < 160);

const routeA = parseRouteState("?destination=Houston&category=hotels&max=9&verifiedOnly=1");
assert.equal(routeA.filters.destination, "Houston");
assert.equal(routeA.filters.category, "hotels");
assert.equal(routeA.filters.maxResults, 9);
assert.equal(routeA.filters.verifiedOnly, true);

const routeB = parseRouteState("?id=hou-workstart-center");
assert.equal(routeB.detailId, "hou-workstart-center");

const parsedTool = parseToolCall('{"tool":"searchListings","args":{"query":"jobs"},"say":"Searching"}');
assert.equal(parsedTool.tool, "searchListings");
assert.equal(parsedTool.args.query, "jobs");

const searchResult = searchListings(DEFAULT_LISTINGS, { query: "resume", city: "Houston", limit: 3 });
assert.ok(searchResult.length >= 1);
assert.equal(searchResult[0].id, "hou-workstart-center");

const trip3 = buildItinerary(DEFAULT_LISTINGS, { destination: "Houston", maxStops: 3 });
const trip6 = buildItinerary(DEFAULT_LISTINGS, { destination: "Houston", maxStops: 6 });
const trip9 = buildItinerary(DEFAULT_LISTINGS, { destination: "Houston", maxStops: 9 });
assert.equal(trip3.stops.length, 3);
assert.ok(trip6.stops.length <= 6 && trip6.stops.length >= 3);
assert.ok(trip9.stops.length <= 9 && trip9.stops.length >= 3);

const contextPrivate = buildContext({ listings: DEFAULT_LISTINGS, query: "hotel", privacyMode: true });
assert.ok(contextPrivate.length >= 1);
assert.equal(contextPrivate[0].address, undefined);
const contextOpen = buildContext({ listings: DEFAULT_LISTINGS, query: "hotel", privacyMode: false });
assert.ok("address" in contextOpen[0] || "phone" in contextOpen[0] || "url" in contextOpen[0]);

assert.equal(normalize("  SHUTTLE "), "shuttle");
console.log("All tests passed");
