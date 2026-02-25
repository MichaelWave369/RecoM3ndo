# RecoM3ndo Traveler Assistant

A lightweight web app that helps travelers find support and recommendations across:

- Dining
- Hotels
- Entertainment
- Contractors
- Government assistance
- Employment programs

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Next-phase upgrades included

- Added keyword search for matching by name/description/tags.
- Added optional "verified only" filtering for trusted listings.
- Added max-results selector (Top 3 / 6 / 9).
- Added fallback recommendation mode: if exact filters return no results, the app relaxes budget/style while keeping destination and category intent.
- Added score badges and summary messaging to improve explainability.
- Added reset controls for faster repeated planning.

## Testing

- JavaScript syntax check with `node --check app.js`.
- Functional logic checks with `node test.js`.
- Local serve verification with `curl -I http://127.0.0.1:8000/index.html`.
