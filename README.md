# RecoM3ndo Traveler Assistant

RecoM3ndo is a framework-free traveler companion app for dining, hotels, entertainment, contractors, government support, and employment programs.

## v0.3.0 (Phase 9)

- **PWA + Offline-first**: service worker cache, manifest, install hint, and offline banner.
- **Location-aware sorting**: optional geolocation on click, distance display, sort by nearest/verified/best.
- **Detail links**: `?id=<listingId>` opens single listing detail with back-to-results.
- **Data Packs + Favorites + Share links** remain supported.
- **Actions** on cards/details: Open in Maps, Call, Website (when available).

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Manual checks

1. Search and click **Copy Share Link**, then open URL and verify filters restore.
2. Open detail using `?id=hou-workstart-center` and verify detail view appears.
3. Click **Use my location**, then choose **Sort: Nearest** and verify distance labels appear where coordinates exist.
4. Turn off network after initial load and refresh: app shell should still load from cache and show offline banner.
5. Use **Data** modal import/export/reset and verify friendly validation errors for invalid pack data.

## Dev checks

```bash
npm run check
npm test
```

(Equivalent to `node --check app.js` and `node test.js`.)
