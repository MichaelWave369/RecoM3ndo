(function (globalScope) {
  const local = {
    priceline: globalScope.RecoDealProviderPriceline,
    expedia: globalScope.RecoDealProviderExpedia,
    booking: globalScope.RecoDealProviderBooking,
    skyscanner: globalScope.RecoDealProviderSkyscanner,
    google: globalScope.RecoDealProviderGoogle
  };

  const providers = Object.values(local).filter(Boolean);

  if (!providers.length && typeof module !== "undefined" && module.exports) {
    const priceline = require("./priceline.js");
    const expedia = require("./expedia.js");
    const booking = require("./booking.js");
    const skyscanner = require("./skyscanner.js");
    const google = require("./google-travel.js");
    module.exports = [priceline, expedia, booking, skyscanner, google];
  } else {
    globalScope.RecoDealProviders = providers;
  }
})(typeof window !== "undefined" ? window : globalThis);
