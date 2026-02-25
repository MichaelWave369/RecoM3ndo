# RecoM3ndo Traveler Companion

RecoM3ndo is a framework-free traveler companion app for dining, hotels, entertainment, contractors, government support, and employment programs.

## v0.6.0 Highlights

- **AI Companion Drawer**: embedded assistant with chat history, quick actions, clear/export chat, and settings.
- **Tool Protocol**: assistant can call local tools (`searchListings`, `recommend`, `getListingById`, `setForm`, `openListing`, `buildItinerary`) using JSON tool calls.
- **Provider options**:
  - Ollama (local) default (`llama3.1`)
  - OpenAI-compatible endpoint (BYO base URL/model/key)
- **Privacy Mode** (default ON): sends only redacted snippets (no full pack, no exact geocoordinates).
- **Local fallback mode**: if LLM connection fails, the assistant uses rule-based local tool execution.
- **Creator Mode + Diagnostics + Upgrade Guard** remain included.

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

## Assistant usage

1. Click **Assistant** in the header.
2. Ask naturally, for example:
   - “Find verified family-friendly stuff in Houston under mid budget.”
   - “What’s the best employment program listing?”
   - “Plan a 1-day itinerary.”
3. Use quick actions for faster workflows.
4. Use **Clear Chat** / **Export Chat JSON** as needed.

## Ollama setup (local)

1. Install Ollama and start it.
2. Ensure local API is available at `http://localhost:11434`.
3. Pull a model such as `llama3.1` and keep the default provider set to **Ollama (local)**.

## OpenAI-compatible setup

1. Switch provider to **OpenAI-Compatible**.
2. Fill Base URL, Model, and API key.
3. These values are stored in browser `localStorage` (local-only warning is shown in UI).

## Privacy Mode

- **ON (default)**: assistant context includes only minimal snippets (name, tags, category, verified, short description).
- **OFF**: context may include address/phone/url for matched snippets.
- Geolocation coordinates are not persisted by the app.

## Troubleshooting

- If model calls fail, assistant falls back to local tool-only mode.
- If UI seems stale after updates, clear site data and refresh (service worker cache).
- Run `npm run guard` to confirm required hooks/files/wiring are present.

## Creator Mode + Diagnostics

- Creator Mode supports add/edit/delete listings with schema validation and duplicate detection.
- Diagnostics shows version, data source, listing/favorites counts, localStorage estimate, and last guard status.
- Diagnostics includes **Download My Data** and **Clear All Local Data**.
