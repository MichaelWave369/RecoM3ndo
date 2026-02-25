(function (globalScope) {
  const listings = [
    {
      name: "Bayou Bites",
      city: "Houston",
      category: "dining",
      budget: "mid",
      styles: ["family", "budget"],
      description: "Local cuisine and vegetarian options near downtown.",
      tags: ["Open late", "Kid menu", "Transit nearby"],
      verified: true
    },
    {
      name: "Capitol Stay Suites",
      city: "Austin",
      category: "hotels",
      budget: "mid",
      styles: ["business", "solo"],
      description: "Work-friendly hotel with co-working lounge and airport shuttle.",
      tags: ["Wi-Fi", "Breakfast", "Airport shuttle"],
      verified: true
    },
    {
      name: "Metro Skills Employment Hub",
      city: "Dallas",
      category: "employment_programs",
      budget: "low",
      styles: ["budget", "solo"],
      description: "Job placement, resume reviews, and free upskilling workshops.",
      tags: ["Career coaching", "No-cost training", "Hiring events"],
      verified: true
    },
    {
      name: "River Walk Performances",
      city: "San Antonio",
      category: "entertainment",
      budget: "low",
      styles: ["family", "solo", "budget"],
      description: "Nightly live music and cultural performances by the river.",
      tags: ["Live music", "Outdoor", "Accessible"],
      verified: false
    },
    {
      name: "Lone Star Home Repair Network",
      city: "Houston",
      category: "contractors",
      budget: "mid",
      styles: ["family", "business"],
      description: "Verified contractors for emergency home and rental repairs.",
      tags: ["Verified licenses", "24/7 support", "Multi-language"],
      verified: true
    },
    {
      name: "City Support Resource Center",
      city: "Austin",
      category: "government_assistance",
      budget: "low",
      styles: ["family", "budget", "solo"],
      description: "Guidance for transit cards, food aid, and temporary housing support.",
      tags: ["Case workers", "Walk-in help", "Document checklist"],
      verified: true
    },
    {
      name: "Convention District Hotel",
      city: "Dallas",
      category: "hotels",
      budget: "high",
      styles: ["business"],
      description: "Premium business lodging close to convention spaces.",
      tags: ["Conference rooms", "Gym", "Lounge"],
      verified: true
    },
    {
      name: "Budget Bistro Loop",
      city: "San Antonio",
      category: "dining",
      budget: "low",
      styles: ["budget", "family"],
      description: "Affordable local meals with quick service and family seating.",
      tags: ["Under $15", "Quick service", "Family tables"],
      verified: false
    },
    {
      name: "WorkStart Center",
      city: "Houston",
      category: "employment_programs",
      budget: "low",
      styles: ["budget", "solo", "business"],
      description: "Workforce center with interview prep and short-term certifications.",
      tags: ["Resume clinic", "Employer partners", "Certification vouchers"],
      verified: true
    },
    {
      name: "Harborline Inn",
      city: "Houston",
      category: "hotels",
      budget: "high",
      styles: ["business", "family"],
      description: "Comfortable hotel with business center and child-friendly amenities.",
      tags: ["Business lounge", "Pool", "Free parking"],
      verified: true
    }
  ];

  function normalize(value) {
    return (value || "").trim().toLowerCase();
  }

  function matchesKeyword(item, keyword) {
    if (!keyword) return true;
    const searchable = [item.name, item.description, item.category, ...item.tags].join(" ").toLowerCase();
    return searchable.includes(keyword);
  }

  function scoreListing(item, filters) {
    let score = 0;
    if (item.city === filters.destination) score += 4;
    if (filters.category === "all" || item.category === filters.category) score += 3;
    if (filters.budget === "any" || item.budget === filters.budget) score += 2;
    if (filters.style === "any" || item.styles.includes(filters.style)) score += 2;
    if (matchesKeyword(item, filters.keyword)) score += 2;
    if (item.verified) score += 1;
    return score;
  }

  function exactMatch(item, filters) {
    if (item.city !== filters.destination) return false;
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.budget !== "any" && item.budget !== filters.budget) return false;
    if (filters.style !== "any" && !item.styles.includes(filters.style)) return false;
    if (!matchesKeyword(item, filters.keyword)) return false;
    if (filters.verifiedOnly && !item.verified) return false;
    return true;
  }

  function relaxedMatch(item, filters) {
    if (item.city !== filters.destination) return false;
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (!matchesKeyword(item, filters.keyword)) return false;
    if (filters.verifiedOnly && !item.verified) return false;
    return true;
  }

  function getRecommendations(filters) {
    const normalizedFilters = {
      ...filters,
      keyword: normalize(filters.keyword),
      maxResults: Number(filters.maxResults || 6)
    };

    const withScore = listings
      .map((item) => ({ ...item, score: scoreListing(item, normalizedFilters) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    const exact = withScore.filter((item) => exactMatch(item, normalizedFilters));
    if (exact.length > 0) {
      return {
        items: exact.slice(0, normalizedFilters.maxResults),
        relaxed: false
      };
    }

    const relaxed = withScore.filter((item) => relaxedMatch(item, normalizedFilters));
    return {
      items: relaxed.slice(0, normalizedFilters.maxResults),
      relaxed: true
    };
  }

  const api = { listings, normalize, matchesKeyword, getRecommendations };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.RecoM3ndo = api;
})(typeof window !== "undefined" ? window : globalThis);
