# RecoM3ndo Traveler Companion

RecoM3ndo is a local-first, framework-free traveler companion app for recommendations, map exploration, assistant workflows, deals link-outs, and resource planning.

## v0.8.0 Highlights — Deals Hub + Free Finder

- **Deals Hub** with tabs for Hotels / Flights / Cars / Things to do.
- Provider adapters for:
  - Priceline (deeplink + partner-gated API placeholder)
  - Expedia (deeplink)
  - Booking.com (deeplink)
  - Skyscanner (deeplink)
  - Google Travel/Search (deeplink)
- **No scraping**: only official deep links (and optional proxy-mode API interface for partner integrations).
- Per-provider settings (enabled + affiliateId), stored locally.
- Saved deal searches (run/delete), persisted locally.
- **Free Finder** curated categories for free internet, food, coupons, events, essentials, and assistance.
- Resource notes with local save + export/import JSON.
- Assistant tools extended for deals and free-plan helpers.

## Map View + Directions

- Header **Map** button opens map panel.
- Default map provider: **Leaflet + OSM** (no API key required).
- Optional map provider: **Google Maps** with user-provided API key.
- Marker selection syncs with cards.
- Directions button opens maps deep links for selected/top listing.

## Security & integration notes

- Do not store partner API secrets in static client code.
- For partner-gated APIs, use **proxy mode**: app sends params to your proxy endpoint, proxy handles secrets and returns normalized offers.
- For Google Maps key, apply:
  - HTTP referrer restrictions
  - API restrictions (Maps JavaScript API and only required APIs)

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Verify everything

```bash
npm run verify
```

Runs:
- `npm run check` (`node --check app.js`)
- `npm run test` (`node test.js`)
- `npm run guard` (`node scripts/upgrade-guard.mjs`)

Upgrade Guard outputs PASS/FAIL checklist and writes `upgrade-guard-report.json`.

## Assistant usage

Use **Assistant** and ask prompts like:
- “Find verified family-friendly options in Houston under mid budget.”
- “Show results on map.”
- “Find hotel deals.”
- “Build a free plan for wifi and food in Dallas.”

Assistant can run local tools only; it does not invent listings.

## Ollama / OpenAI-compatible

- Default provider: Ollama (`http://localhost:11434`) with model `llama3.1`.
- Optional OpenAI-compatible endpoint with BYO base URL/model/key.
- Provider settings are stored in browser localStorage.

## Privacy Mode

- ON by default for assistant context minimization.
- Assistant context excludes sensitive fields and exact user coords when enabled.
- Map rendering remains local UI behavior.

## Troubleshooting

- If Google Maps fails, switch provider to Leaflet.
- If model calls fail, assistant uses local tool-only fallback.
- If stale behavior appears, clear site data and refresh.
- Run `npm run guard` to confirm hooks/files/wiring are installed.
