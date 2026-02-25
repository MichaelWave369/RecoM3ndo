(function (globalScope) {
  const VALID_BUDGETS = ["low", "mid", "high"];
  const VALID_STYLES = ["family", "solo", "business", "budget", "any"];

  const DEFAULT_LISTINGS = [
    {
      id: "hou-bayou-bites",
      name: "Bayou Bites",
      city: "Houston",
      category: "dining",
      budget: "mid",
      style: "family",
      styles: ["family", "budget"],
      description: "Local cuisine and vegetarian options near downtown.",
      tags: ["Open late", "Kid menu", "Transit nearby"],
      verified: true
    },
    {
      id: "aus-capitol-stay-suites",
      name: "Capitol Stay Suites",
      city: "Austin",
      category: "hotels",
      budget: "mid",
      style: "business",
      styles: ["business", "solo"],
      description: "Work-friendly hotel with co-working lounge and airport shuttle.",
      tags: ["Wi-Fi", "Breakfast", "Airport shuttle"],
      verified: true
    },
    {
      id: "dal-metro-skills-hub",
      name: "Metro Skills Employment Hub",
      city: "Dallas",
      category: "employment_programs",
      budget: "low",
      style: "budget",
      styles: ["budget", "solo"],
      description: "Job placement, resume reviews, and free upskilling workshops.",
      tags: ["Career coaching", "No-cost training", "Hiring events"],
      verified: true
    },
    {
      id: "sat-riverwalk-performances",
      name: "River Walk Performances",
      city: "San Antonio",
      category: "entertainment",
      budget: "low",
      style: "family",
      styles: ["family", "solo", "budget"],
      description: "Nightly live music and cultural performances by the river.",
      tags: ["Live music", "Outdoor", "Accessible"],
      verified: false
    },
    {
      id: "hou-lone-star-home-repair",
      name: "Lone Star Home Repair Network",
      city: "Houston",
      category: "contractors",
      budget: "mid",
      style: "business",
      styles: ["family", "business"],
      description: "Verified contractors for emergency home and rental repairs.",
      tags: ["Verified licenses", "24/7 support", "Multi-language"],
      verified: true
    },
    {
      id: "aus-city-support-center",
      name: "City Support Resource Center",
      city: "Austin",
      category: "government_assistance",
      budget: "low",
      style: "family",
      styles: ["family", "budget", "solo"],
      description: "Guidance for transit cards, food aid, and temporary housing support.",
      tags: ["Case workers", "Walk-in help", "Document checklist"],
      verified: true
    },
    {
      id: "dal-convention-district-hotel",
      name: "Convention District Hotel",
      city: "Dallas",
      category: "hotels",
      budget: "high",
      style: "business",
      styles: ["business"],
      description: "Premium business lodging close to convention spaces.",
      tags: ["Conference rooms", "Gym", "Lounge"],
      verified: true
    },
    {
      id: "sat-budget-bistro-loop",
      name: "Budget Bistro Loop",
      city: "San Antonio",
      category: "dining",
      budget: "low",
      style: "budget",
      styles: ["budget", "family"],
      description: "Affordable local meals with quick service and family seating.",
      tags: ["Under $15", "Quick service", "Family tables"],
      verified: false
    },
    {
      id: "hou-workstart-center",
      name: "WorkStart Center",
      city: "Houston",
      category: "employment_programs",
      budget: "low",
      style: "budget",
      styles: ["budget", "solo", "business"],
      description: "Workforce center with interview prep and short-term certifications.",
      tags: ["Resume clinic", "Employer partners", "Certification vouchers"],
      verified: true
    },
    {
      id: "hou-harborline-inn",
      name: "Harborline Inn",
      city: "Houston",
      category: "hotels",
      budget: "high",
      style: "business",
      styles: ["business", "family"],
      description: "Comfortable hotel with business center and child-friendly amenities.",
      tags: ["Business lounge", "Pool", "Free parking"],
      verified: true
    }
  ];

  function normalize(value) {
    return (value || "").trim().toLowerCase();
  }

  function toArrayStyles(item) {
    if (Array.isArray(item.styles) && item.styles.length) return item.styles;
    if (item.style) return [item.style];
    return ["any"];
  }

  function normalizeListing(item, index) {
    return {
      ...item,
      id: item.id || `listing-${index}`,
      style: item.style || (toArrayStyles(item)[0] || "any"),
      styles: toArrayStyles(item)
    };
  }

  function toPackListing(item) {
    return {
      id: item.id,
      name: item.name,
      city: item.city,
      category: item.category,
      budget: item.budget,
      style: item.style || toArrayStyles(item)[0] || "any",
      description: item.description,
      tags: item.tags,
      verified: Boolean(item.verified),
      ...(item.url ? { url: item.url } : {}),
      ...(item.phone ? { phone: item.phone } : {}),
      ...(item.address ? { address: item.address } : {}),
      ...(typeof item.lat === "number" ? { lat: item.lat } : {}),
      ...(typeof item.lng === "number" ? { lng: item.lng } : {})
    };
  }

  function validateListingPack(pack) {
    const errors = [];

    if (!Array.isArray(pack)) {
      return { valid: false, errors: ["Pack must be an array of listing objects."] };
    }

    pack.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`Item ${index + 1}: must be an object.`);
        return;
      }

      const requiredStringFields = ["id", "name", "city", "category", "description"];
      requiredStringFields.forEach((field) => {
        if (typeof item[field] !== "string" || !item[field].trim()) {
          errors.push(`Item ${index + 1}: ${field} must be a non-empty string.`);
        }
      });

      if (!VALID_BUDGETS.includes(item.budget)) {
        errors.push(`Item ${index + 1}: budget must be one of ${VALID_BUDGETS.join(", ")}.`);
      }

      if (!VALID_STYLES.includes(item.style)) {
        errors.push(`Item ${index + 1}: style must be one of ${VALID_STYLES.join(", ")}.`);
      }

      if (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== "string")) {
        errors.push(`Item ${index + 1}: tags must be an array of strings.`);
      }

      if (typeof item.verified !== "boolean") {
        errors.push(`Item ${index + 1}: verified must be boolean.`);
      }

      ["url", "phone", "address"].forEach((field) => {
        if (item[field] !== undefined && typeof item[field] !== "string") {
          errors.push(`Item ${index + 1}: ${field} must be a string when provided.`);
        }
      });

      ["lat", "lng"].forEach((field) => {
        if (item[field] !== undefined && typeof item[field] !== "number") {
          errors.push(`Item ${index + 1}: ${field} must be a number when provided.`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  }

  function matchesKeyword(item, keyword) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return { matched: true, source: "none" };

    const tagHit = item.tags.some((tag) => normalize(tag).includes(normalizedKeyword));
    if (tagHit) return { matched: true, source: "tags" };

    const descriptionHit = normalize(item.description).includes(normalizedKeyword);
    if (descriptionHit) return { matched: true, source: "description" };

    const nameHit = normalize(item.name).includes(normalizedKeyword);
    if (nameHit) return { matched: true, source: "name" };

    return { matched: false, source: "none" };
  }

  function itemHasStyle(item, style) {
    return style === "any" || toArrayStyles(item).includes(style) || item.style === style;
  }

  function scoreListing(item, filters) {
    let score = 0;
    if (item.city === filters.destination) score += 4;
    if (filters.category === "all" || item.category === filters.category) score += 3;
    if (filters.budget === "any" || item.budget === filters.budget) score += 2;
    if (itemHasStyle(item, filters.style)) score += 2;

    const keyword = matchesKeyword(item, filters.keyword);
    if (keyword.matched) score += 2;
    if (item.verified) score += 1;
    return score;
  }

  function explainMatch(item, filters, isRelaxed) {
    const reasons = [];

    if (item.city === filters.destination) reasons.push(`City matched: ${filters.destination}.`);
    if (filters.category === "all" || item.category === filters.category) reasons.push(`Category matched: ${item.category}.`);
    if (filters.budget === "any" || item.budget === filters.budget) reasons.push(`Budget matched: ${item.budget}.`);
    if (itemHasStyle(item, filters.style)) reasons.push(`Style matched: ${filters.style === "any" ? "any" : filters.style}.`);

    const keywordResult = matchesKeyword(item, filters.keyword);
    if (normalize(filters.keyword)) {
      if (keywordResult.matched) {
        reasons.push(`Keyword matched in ${keywordResult.source}.`);
      } else {
        reasons.push("Keyword was not an exact hit.");
      }
    }

    if (isRelaxed) {
      const relaxedFields = [];
      if (filters.budget !== "any" && item.budget !== filters.budget) relaxedFields.push("budget");
      if (filters.style !== "any" && !itemHasStyle(item, filters.style)) relaxedFields.push("style");
      if (relaxedFields.length) {
        reasons.push(`Relaxed match: broadened ${relaxedFields.join(" and ")} constraints.`);
      } else {
        reasons.push("Relaxed match mode was used to broaden results.");
      }
    }

    return reasons;
  }

  function normalizeFilters(inputFilters) {
    const favoriteIds = inputFilters.favoriteIds
      ? new Set(Array.isArray(inputFilters.favoriteIds) ? inputFilters.favoriteIds : Array.from(inputFilters.favoriteIds))
      : null;

    return {
      destination: inputFilters.destination || "",
      category: inputFilters.category || "all",
      budget: inputFilters.budget || "any",
      style: inputFilters.style || "any",
      keyword: normalize(inputFilters.keyword),
      maxResults: Number(inputFilters.maxResults || 6),
      verifiedOnly: Boolean(inputFilters.verifiedOnly),
      favoritesOnly: Boolean(inputFilters.favoritesOnly),
      favoriteIds
    };
  }

  function passesBaseFilters(item, filters) {
    if (item.city !== filters.destination) return false;
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.verifiedOnly && !item.verified) return false;
    if (filters.favoritesOnly && (!filters.favoriteIds || !filters.favoriteIds.has(item.id))) return false;
    if (!matchesKeyword(item, filters.keyword).matched) return false;
    return true;
  }

  function exactMatch(item, filters) {
    if (!passesBaseFilters(item, filters)) return false;
    if (filters.budget !== "any" && item.budget !== filters.budget) return false;
    if (filters.style !== "any" && !itemHasStyle(item, filters.style)) return false;
    return true;
  }

  function relaxedMatch(item, filters) {
    return passesBaseFilters(item, filters);
  }

  function getRecommendations(listingsOrFilters, maybeFilters) {
    const hasCustomListings = Array.isArray(listingsOrFilters);
    const rawListings = hasCustomListings ? listingsOrFilters : DEFAULT_LISTINGS;
    const filters = normalizeFilters(hasCustomListings ? maybeFilters || {} : listingsOrFilters || {});

    const listings = rawListings.map(normalizeListing);

    const withScore = listings
      .map((item, index) => ({ ...item, score: scoreListing(item, filters), _idx: index }))
      .sort((a, b) => b.score - a.score || a._idx - b._idx);

    const exact = withScore.filter((item) => exactMatch(item, filters));
    const relaxed = withScore.filter((item) => relaxedMatch(item, filters));

    const isRelaxed = exact.length === 0;
    const chosen = (isRelaxed ? relaxed : exact)
      .slice(0, filters.maxResults)
      .map(({ _idx, ...item }) => ({
        ...item,
        explanation: explainMatch(item, filters, isRelaxed)
      }));

    return {
      items: chosen,
      relaxed: isRelaxed
    };
  }

  function haversineMiles(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 3958.8;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function parseRouteState(queryString) {
    const raw = queryString.startsWith("?") ? queryString.slice(1) : queryString;
    const params = new URLSearchParams(raw);
    const detailId = params.get("id") || "";
    return {
      detailId,
      filters: {
        destination: params.get("destination") || "",
        category: params.get("category") || "all",
        budget: params.get("budget") || "any",
        style: params.get("style") || "any",
        keyword: params.get("keyword") || "",
        maxResults: Number(params.get("max") || 6),
        verifiedOnly: params.get("verifiedOnly") === "1",
        favoritesOnly: params.get("favoritesOnly") === "1"
      }
    };
  }

  const api = {
    DEFAULT_LISTINGS,
    normalize,
    matchesKeyword,
    validateListingPack,
    toPackListing,
    getRecommendations,
    haversineMiles,
    parseRouteState
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.RecoM3ndo = api;
})(typeof window !== "undefined" ? window : globalThis);
