(function (globalScope) {
  const { safeEncode } = globalScope.RecoDealsDeep || require("../deeplinks.js");
  const provider = {
    id: "expedia",
    name: "Expedia",
    modes: ["deeplink"],
    buildLink(params, tracking = {}) {
      const aff = tracking.affiliateId ? `&affcid=${safeEncode(tracking.affiliateId)}` : "";
      if (params.vertical === "flights") {
        return `https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=from:${safeEncode(params.origin)},to:${safeEncode(params.destination)},departure:${safeEncode(params.departDate)}TANYT&leg2=from:${safeEncode(params.destination)},to:${safeEncode(params.origin)},departure:${safeEncode(params.returnDate)}TANYT&adults=${safeEncode(params.adults)}${aff}`;
      }
      if (params.vertical === "cars") {
        return `https://www.expedia.com/Car-Rentals-Search?locn=${safeEncode(params.destination)}&d1=${safeEncode(params.checkIn)}&d2=${safeEncode(params.checkOut)}${aff}`;
      }
      if (params.vertical === "things") {
        return `https://www.expedia.com/Things-To-Do-Search?destination=${safeEncode(params.destination)}${aff}`;
      }
      return `https://www.expedia.com/Hotel-Search?destination=${safeEncode(params.destination)}&startDate=${safeEncode(params.checkIn)}&endDate=${safeEncode(params.checkOut)}&adults=${safeEncode(params.adults)}${aff}`;
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = provider;
  globalScope.RecoDealProviderExpedia = provider;
})(typeof window !== "undefined" ? window : globalThis);
