(function (globalScope) {
  function validateCoordinate(value, type) {
    const num = Number(value);
    if (Number.isNaN(num)) return { valid: false, value: null, reason: "Not a number" };
    if (type === "lat" && (num < -90 || num > 90)) return { valid: false, value: null, reason: "Latitude out of range" };
    if (type === "lng" && (num < -180 || num > 180)) return { valid: false, value: null, reason: "Longitude out of range" };
    return { valid: true, value: num };
  }

  function mapUrlForListing(listing, userLoc) {
    if (!listing) return "";
    const base = "https://www.google.com/maps/search/?api=1&query=";
    if (typeof listing.lat === "number" && typeof listing.lng === "number") {
      return `${base}${listing.lat},${listing.lng}`;
    }
    if (listing.address) {
      return `${base}${encodeURIComponent(listing.address)}`;
    }
    if (userLoc && typeof userLoc.lat === "number" && typeof userLoc.lng === "number") {
      return `${base}${userLoc.lat},${userLoc.lng}`;
    }
    return `${base}${encodeURIComponent(`${listing.name || "Listing"} ${listing.city || ""}`.trim())}`;
  }

  function applyShowOnMapState(current, args = {}) {
    return {
      ...current,
      showMode: args.scope || current.showMode || "results",
      selectedId: args.selectedId || current.selectedId || null,
      visible: true
    };
  }

  const api = { validateCoordinate, mapUrlForListing, applyShowOnMapState };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.RecoGeo = api;
})(typeof window !== "undefined" ? window : globalThis);
