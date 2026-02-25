(function (globalScope) {
  const { safeEncode } = globalScope.RecoDealsDeep || require("../deeplinks.js");
  const provider = {
    id: "priceline",
    name: "Priceline",
    modes: ["deeplink", "api"],
    apiNote: "Partner Solutions API is partner-gated. Use proxy endpoint in client settings.",
    buildLink(params, tracking = {}) {
      const aff = tracking.affiliateId ? `&aid=${safeEncode(tracking.affiliateId)}` : "";
      if (params.vertical === "flights") {
        return `https://www.priceline.com/relax/flights/${safeEncode(params.origin)}-${safeEncode(params.destination)}?departureDate=${safeEncode(params.departDate)}&returnDate=${safeEncode(params.returnDate)}&adults=${safeEncode(params.adults)}${aff}`;
      }
      if (params.vertical === "cars") {
        return `https://www.priceline.com/rental-cars/${safeEncode(params.destination)}?pickup=${safeEncode(params.checkIn)}&dropoff=${safeEncode(params.checkOut)}${aff}`;
      }
      return `https://www.priceline.com/stay/#/search/?cityId=${safeEncode(params.destination)}&checkIn=${safeEncode(params.checkIn)}&checkOut=${safeEncode(params.checkOut)}&rooms=1&adults=${safeEncode(params.adults)}${aff}`;
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = provider;
  globalScope.RecoDealProviderPriceline = provider;
})(typeof window !== "undefined" ? window : globalThis);
