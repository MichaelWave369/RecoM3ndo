(function (globalScope) {
  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function toSnippet(description, max = 120) {
    const text = String(description || "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function scoreSearch(item, args) {
    let score = 0;
    const q = normalize(args.query);
    if (!q) score += 1;
    if (q && normalize(item.name).includes(q)) score += 5;
    if (q && normalize(item.description).includes(q)) score += 3;
    if (q && (item.tags || []).some((t) => normalize(t).includes(q))) score += 4;
    if (args.city && normalize(item.city) === normalize(args.city)) score += 3;
    if (args.category && args.category !== "all" && item.category === args.category) score += 2;
    if (args.budget && args.budget !== "any" && item.budget === args.budget) score += 1;
    if (args.style && args.style !== "any" && ((item.styles || [item.style]).includes(args.style) || item.style === args.style)) score += 1;
    if (args.verifiedOnly && item.verified) score += 2;
    return score;
  }

  function applyCommonFilters(item, args, favoriteIds) {
    if (args.city && normalize(item.city) !== normalize(args.city)) return false;
    if (args.category && args.category !== "all" && item.category !== args.category) return false;
    if (args.budget && args.budget !== "any" && item.budget !== args.budget) return false;
    if (args.style && args.style !== "any") {
      const styles = item.styles || (item.style ? [item.style] : []);
      if (!(styles.includes(args.style) || item.style === args.style)) return false;
    }
    if (args.verifiedOnly && !item.verified) return false;
    if (args.favoritesOnly && (!favoriteIds || !favoriteIds.has(item.id))) return false;
    return true;
  }

  function searchListings(listings, args = {}, favoriteIds = null) {
    const limit = Number(args.limit || 6);
    const q = normalize(args.query);
    return listings
      .filter((item) => applyCommonFilters(item, args, favoriteIds))
      .filter((item) => {
        if (!q) return true;
        return (
          normalize(item.name).includes(q)
          || normalize(item.description).includes(q)
          || (item.tags || []).some((t) => normalize(t).includes(q))
        );
      })
      .map((item) => ({ item, score: scoreSearch(item, args) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item, score }) => ({
        id: item.id,
        name: item.name,
        city: item.city,
        category: item.category,
        tags: item.tags || [],
        verified: Boolean(item.verified),
        descriptionSnippet: toSnippet(item.description),
        score
      }));
  }

  function getListingById(listings, { id }) {
    return listings.find((item) => item.id === id) || null;
  }

  function recommend(listings, { preferences }) {
    return globalScope.RecoM3ndo.getRecommendations(listings, preferences || {});
  }

  function buildItinerary(listings, { destination, days = 1, maxStops = 3, constraints = {} }) {
    const stopCount = [3, 6, 9].includes(Number(maxStops)) ? Number(maxStops) : 3;
    const pool = listings.filter((item) => {
      if (destination && normalize(item.city) !== normalize(destination)) return false;
      if (constraints.verifiedOnly && !item.verified) return false;
      return true;
    });

    const categories = ["dining", "entertainment", "employment_programs", "government_assistance", "hotels", "contractors"];
    const picked = [];
    categories.forEach((category) => {
      const candidate = pool.find((item) => item.category === category && !picked.some((p) => p.id === item.id));
      if (candidate && picked.length < stopCount) picked.push(candidate);
    });
    pool.forEach((item) => {
      if (picked.length < stopCount && !picked.some((p) => p.id === item.id)) picked.push(item);
    });

    return {
      destination: destination || "any",
      days,
      maxStops: stopCount,
      stops: picked.slice(0, stopCount).map((item, index) => ({
        order: index + 1,
        id: item.id,
        name: item.name,
        category: item.category,
        city: item.city,
        verified: Boolean(item.verified)
      }))
    };
  }

  function buildContext({ listings, query, privacyMode = true }) {
    const snippets = searchListings(listings, { query, limit: 6 });
    if (privacyMode) {
      return snippets.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        category: s.category,
        tags: s.tags,
        verified: s.verified,
        descriptionSnippet: s.descriptionSnippet
      }));
    }

    return snippets.map((s) => {
      const full = listings.find((l) => l.id === s.id) || {};
      return {
        ...s,
        address: full.address,
        phone: full.phone,
        url: full.url
      };
    });
  }

  function parseToolCall(text) {
    const raw = String(text || "").trim();
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const chunk = candidate.slice(start, end + 1);
    try {
      const parsed = JSON.parse(chunk);
      if (!parsed || typeof parsed !== "object" || !parsed.tool) return null;
      return {
        tool: parsed.tool,
        args: parsed.args || {},
        say: parsed.say || ""
      };
    } catch (_error) {
      return null;
    }
  }

  function localRulesAssistant({ message, listings }) {
    const text = normalize(message);
    if (text.includes("itinerary") || text.includes("plan")) {
      const city = ["houston", "austin", "dallas", "san antonio"].find((c) => text.includes(c));
      return {
        tool: "buildItinerary",
        args: { destination: city ? city.replace(/\b\w/g, (m) => m.toUpperCase()) : "", maxStops: text.includes("9") ? 9 : text.includes("6") ? 6 : 3 },
        say: "I can build an itinerary using current listings."
      };
    }
    if (text.includes("best") || text.includes("recommend") || text.includes("find")) {
      const city = ["Houston", "Austin", "Dallas", "San Antonio"].find((c) => text.includes(c.toLowerCase()));
      return {
        tool: "searchListings",
        args: {
          query: message,
          city,
          verifiedOnly: text.includes("verified"),
          style: text.includes("family") ? "family" : "any",
          budget: text.includes("mid") ? "mid" : text.includes("low") ? "low" : text.includes("high") ? "high" : "any",
          limit: 6
        }
      };
    }
    return null;
  }


  function showOnMap(currentMapState, args = {}) {
    return globalScope.RecoGeo.applyShowOnMapState(currentMapState || {}, args);
  }

  function navigateTo(listings, args = {}, userLoc = null) {
    const listing = listings.find((item) => item.id === args.id);
    if (!listing) return { ok: false, error: "Listing not found" };
    return { ok: true, id: listing.id, url: globalScope.RecoGeo.mapUrlForListing(listing, userLoc) };
  }

  const api = {
    searchListings,
    recommend,
    getListingById,
    buildItinerary,
    buildContext,
    parseToolCall,
    localRulesAssistant,
    showOnMap,
    navigateTo
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.RecoTools = api;
})(typeof window !== "undefined" ? window : globalThis);
