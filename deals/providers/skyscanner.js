(function (globalScope) {
  const { safeEncode } = globalScope.RecoDealsDeep || require("../deeplinks.js");
  const provider = {
    id: "skyscanner",
    name: "Skyscanner",
    modes: ["deeplink"],
    buildLink(params, tracking = {}) {
      const aff = tracking.affiliateId ? `?associateid=${safeEncode(tracking.affiliateId)}` : "";
      if (params.vertical === "flights") {
        return `https://www.skyscanner.com/transport/flights/${safeEncode(params.origin)}/${safeEncode(params.destination)}/${safeEncode(params.departDate)}/${safeEncode(params.returnDate)}/${aff}`;
      }
      if (params.vertical === "cars") {
        return `https://www.skyscanner.com/carhire/${safeEncode(params.destination)}/${safeEncode(params.checkIn)}/${safeEncode(params.checkOut)}/${aff}`;
      }
      return `https://www.skyscanner.com/hotels/${safeEncode(params.destination)}/${safeEncode(params.checkIn)}/${safeEncode(params.checkOut)}/${aff}`;
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = provider;
  globalScope.RecoDealProviderSkyscanner = provider;
})(typeof window !== "undefined" ? window : globalThis);
