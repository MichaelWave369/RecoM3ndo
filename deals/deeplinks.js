(function (globalScope) {
  function safeEncode(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function normalizeParams(params = {}) {
    return {
      destination: params.destination || "",
      origin: params.origin || "",
      checkIn: params.checkIn || "",
      checkOut: params.checkOut || "",
      departDate: params.departDate || "",
      returnDate: params.returnDate || "",
      adults: Number(params.adults || 1),
      budget: params.budget || "any",
      style: params.style || "any",
      verifiedOnly: Boolean(params.verifiedOnly)
    };
  }

  function buildHotelLinks(provider, params, tracking = {}) {
    const p = normalizeParams(params);
    return provider.buildLink({ ...p, vertical: "hotels" }, tracking);
  }

  function buildFlightLinks(provider, params, tracking = {}) {
    const p = normalizeParams(params);
    return provider.buildLink({ ...p, vertical: "flights" }, tracking);
  }

  function buildCarLinks(provider, params, tracking = {}) {
    const p = normalizeParams(params);
    return provider.buildLink({ ...p, vertical: "cars" }, tracking);
  }

  const api = { safeEncode, normalizeParams, buildHotelLinks, buildFlightLinks, buildCarLinks };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.RecoDealsDeep = api;
})(typeof window !== "undefined" ? window : globalThis);
