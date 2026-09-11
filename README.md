# LineForge Dispatch

A lightweight, FLICA-inspired flight-simulation dispatch and pairing builder designed around a manual Flightradar24 copy/paste workflow.

## What it does

- Loads OpenFlights `airports.dat` and `airlines.dat` directly in the browser.
- Random airport generator with country/code filters.
- Opens the selected airport's FR24 arrivals or departures page.
- Parses copied FR24 airport schedules into a clean table.
- Opens aircraft-tail FR24 pages and parses copied tail history.
- Build button opens a prefilled SimBrief dispatch page.
- Converts common 2-letter airline codes to ICAO 3-letter codes using `airlines.dat`.
- Uses the aircraft-tail operator code when a tail page provides one (for example KPO).
- Realism-oriented passenger randomization based on the origin airport's local departure hour.
- Optional freight (0–20% of passenger payload) and simulation-only dangerous-goods remarks formatting.
- Holding area, manual or random calendar assignment, 3/7/14/30-day trip views, and planned duty windows.
- Light/dark themes, local browser persistence, JSON backup/restore.

## Run locally

No dependencies are required. Serve the folder with any static HTTP server. Examples:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

> Opening `index.html` directly as a `file://` URL may prevent the browser from fetching the remote OpenFlights `.dat` files because of browser security rules. Use a local HTTP server or deploy to Render.

## Deploy to Render

This repository already includes `render.yaml`.

1. Push all files to a GitHub repository.
2. In Render, create a new Blueprint and connect the repository.
3. Render will create a static site named `lineforge-dispatch`.

No environment variables or server process are required.

## SimBrief behavior

LineForge uses SimBrief's dispatch redirect query parameters (`orig`, `dest`, `type`, `callsign`, `reg`, `pax`, `cargo`, etc.). Imported ICAO aircraft types can be mapped to a SimBrief type in Settings. Each profile also has an explicit fallback value, but LineForge does **not** silently substitute a fallback; you can choose it in the Build dialog if SimBrief does not recognize the imported type.

## Data sources

Default airport data:
`https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat`

Default airline data:
`https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat`

The URLs are editable in Settings.

## Important limits

- FR24 parsing is based on copied visible page text. If FR24 changes its page layout, the parser may need adjustment.
- Times are preserved exactly as copied. The intended workflow is to configure FR24 to show UTC/Zulu before copying.
- Duty windows are simulation planning aids only and are not legal Part 117/121/135 compliance calculations.
- HAZMAT/DG remarks are simulation-only formatting aids. The app does not certify TSA, FAA, ICAO, or IATA compliance.
- All app data is stored in `localStorage` on the current browser/device unless you export a JSON backup.
