# RecoM3ndo Traveler Assistant

RecoM3ndo is a lightweight traveler support web app (vanilla HTML/CSS/JS) for discovering:

- Dining
- Hotels
- Entertainment
- Contractors
- Government assistance
- Employment programs

## v0.2.0 (Phase 6)

- **Data Packs**: loads defaults from `data/listings.json`, supports local JSON import/export, and fallback to in-memory defaults if fetch fails.
- **Favorites**: star listings, persistent favorites in `localStorage`, favorites-only filter, and favorites counter.
- **Shareable Links**: filters are encoded in URL query params and restored on load.
- **Explain-Why Scoring**: each result includes human-readable match reasons, including relaxed-match notes.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Manual checks

1. Run a search and click **Copy Share Link**. Open the copied URL in another tab and verify filters auto-populate and results auto-run.
2. Click stars on cards, refresh the page, and verify **Favorites: N** and favorites-only behavior persist.
3. Open **Data** modal:
   - Import a valid JSON pack and confirm results change.
   - Import invalid JSON and confirm friendly error.
   - Export JSON and confirm file download.
   - Reset to default and confirm defaults restored.

## Automated checks

- `node --check app.js`
- `node test.js`
