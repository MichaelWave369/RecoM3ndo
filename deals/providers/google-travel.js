(function (globalScope) {
  const { safeEncode } = globalScope.RecoDealsDeep || require("../deeplinks.js");
  const provider = {
    id: "google",
    name: "Google Travel/Search",
    modes: ["deeplink"],
    buildLink(params) {
      if (params.vertical === "flights") {
        return `https://www.google.com/travel/flights?q=Flights%20to%20${safeEncode(params.destination)}%20from%20${safeEncode(params.origin)}%20${safeEncode(params.departDate)}`;
      }
      if (params.vertical === "cars") {
        return `https://www.google.com/search?q=car+rental+${safeEncode(params.destination)}+${safeEncode(params.checkIn)}`;
      }
      if (params.vertical === "things") {
        return `https://www.google.com/search?q=things+to+do+in+${safeEncode(params.destination)}`;
      }
      return `https://www.google.com/travel/hotels/${safeEncode(params.destination)}?checkin=${safeEncode(params.checkIn)}&checkout=${safeEncode(params.checkOut)}`;
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = provider;
  globalScope.RecoDealProviderGoogle = provider;
})(typeof window !== "undefined" ? window : globalThis);
