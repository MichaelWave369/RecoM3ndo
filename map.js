(function (globalScope) {
  let leafletMap = null;
  let markers = [];
  let onPickCallback = null;

  function clearMarkers() {
    markers.forEach((m) => m.remove());
    markers = [];
  }

  function initLeafletMap(containerId, center = [29.7604, -95.3698], zoom = 10) {
    if (!globalScope.L) return null;
    if (leafletMap) return leafletMap;
    leafletMap = globalScope.L.map(containerId).setView(center, zoom);
    globalScope.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(leafletMap);

    leafletMap.on("click", (event) => {
      if (onPickCallback) onPickCallback(event.latlng);
    });

    return leafletMap;
  }

  async function initGoogleMap(containerId, apiKey, center = { lat: 29.7604, lng: -95.3698 }, zoom = 10) {
    if (!apiKey) throw new Error("Google Maps API key missing.");
    if (!globalScope.google || !globalScope.google.maps) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const map = new globalScope.google.maps.Map(document.getElementById(containerId), { center, zoom });
    return map;
  }

  function setLeafletMarkers(map, listings, onSelect) {
    if (!map || !globalScope.L) return;
    clearMarkers();
    listings.forEach((item) => {
      if (typeof item.lat !== "number" || typeof item.lng !== "number") return;
      const marker = globalScope.L.marker([item.lat, item.lng]).addTo(map).bindPopup(`<b>${item.name}</b><br>${item.city}`);
      marker.on("click", () => onSelect(item));
      markers.push(marker);
    });
  }

  function focusLeafletMarker(listing) {
    if (!leafletMap || !listing) return;
    leafletMap.setView([listing.lat, listing.lng], 13);
  }

  function setPickLocationMode(callback) {
    onPickCallback = callback;
  }

  const api = {
    initLeafletMap,
    initGoogleMap,
    setLeafletMarkers,
    focusLeafletMarker,
    setPickLocationMode
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.RecoMap = api;
})(typeof window !== "undefined" ? window : globalThis);
