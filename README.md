# RecoM3ndo Traveler Companion

RecoM3ndo is a framework-free traveler companion app for dining, hotels, entertainment, contractors, government support, and employment programs.

## v0.7.0 Highlights

- **Map View + Directions** with provider toggle:
  - Default: **Leaflet + OpenStreetMap** (no key)
  - Optional: **Google Maps** (BYO API key)
- Marker interactions: marker click selects/highlights card, card click focuses marker.
- Map filters: show Results / Favorites / All in City and center by User / Top Result / City.
- Creator Mode helper: **Pick on map** to fill lat/lng, with coordinate validation.
- Assistant tools extended with `showOnMap` and `navigateTo`.
- Upgrade Guard extended to verify map + assistant + prior phase wiring.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Verify everything

```bash
npm run verify
```

This runs:
- `npm run check` (`node --check app.js`)
- `npm run test` (`node test.js`)
- `npm run guard` (`node scripts/upgrade-guard.mjs`)

The guard prints PASS/FAIL checks and writes `upgrade-guard-report.json`.

## Map View usage

1. Click **Map** in header.
2. Select provider (`Leaflet + OSM` by default).
3. Choose Show mode (Results/Favorites/City) and Center mode.
4. Use **Directions to selected** to open maps deep-link.

### Google Maps option

1. Choose provider: **Google Maps**.
2. Enter API key in map panel.
3. Keep key restricted:
   - HTTP referrer restrictions (your domain/localhost)
   - API restrictions (Maps JavaScript API only, plus any route services you explicitly use)

## Assistant usage

1. Click **Assistant** in header.
2. Ask naturally, e.g.:
   - “Find verified family-friendly stuff in Houston under mid budget.”
   - “Show results on map.”
   - “Navigate to top pick.”
3. Configure provider settings in drawer.

## Ollama setup (local)

1. Install and run Ollama.
2. Ensure endpoint is reachable at `http://localhost:11434`.
3. Use model like `llama3.1`.

## OpenAI-compatible setup

1. Switch provider to OpenAI-Compatible.
2. Fill base URL, model, and API key.
3. Credentials are stored locally in browser storage.

## Privacy Mode

- ON by default for assistant context redaction.
- With Privacy Mode ON, assistant context excludes sensitive fields and exact user coordinates.
- Map UI still works locally on-device.

## Troubleshooting

- If Google Maps fails to load, app falls back to Leaflet.
- If model calls fail, assistant uses local tool-only fallback.
- If stale assets appear after updates, clear site data and refresh (service worker cache).
- Run `npm run guard` to verify installation and wiring.
