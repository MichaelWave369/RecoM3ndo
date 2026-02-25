(function (globalScope) {
  const { safeEncode } = globalScope.RecoDealsDeep || require("../deeplinks.js");
  const provider = {
    id: "booking",
    name: "Booking.com",
    modes: ["deeplink"],
    buildLink(params, tracking = {}) {
      const aff = tracking.affiliateId ? `&aid=${safeEncode(tracking.affiliateId)}` : "";
      return `https://www.booking.com/searchresults.html?ss=${safeEncode(params.destination)}&checkin=${safeEncode(params.checkIn)}&checkout=${safeEncode(params.checkOut)}&group_adults=${safeEncode(params.adults)}${aff}`;
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = provider;
  globalScope.RecoDealProviderBooking = provider;
})(typeof window !== "undefined" ? window : globalThis);
