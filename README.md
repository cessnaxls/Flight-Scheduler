# LineForge Dispatch

A FLICA-style flight-simulation dispatch and trip-building web app.

## Current workflow

### Flight Desk
Airport Desk and Tail Finder live together on a single tab.

- Airport generator defaults to the United States.
- Large, medium, and small airport classes can be independently included/excluded.
- Airport data is based on OpenFlights `airports.dat`, with airport-size metadata used for size filtering.
- Tail Finder defaults to United States **registration** (`N` registration), not aircraft location or ISO country.
- Tail Finder can filter by ICAO aircraft type and use ADSB.lol/OpenSky through the LineForge backend.

### FR24 import
There is no visible paste textarea.

1. Open an FR24 airport schedule or aircraft-history page.
2. Copy the page text in Safari.
3. Return to LineForge and press **Import copied FR24 page**.
4. LineForge reads the clipboard during that button press and sends the copied text to `/api/parse-fr24`.
5. The Node backend detects and parses the FR24 page.
6. The app switches to **Flight Results**, which contains the tabulated results and filters only.

Parsing logic is server-side. The browser does not parse FR24 text.

### Flight Results filters
- Airline ICAO code
- Aircraft ICAO type
- Departure
- Destination

Rows retain the Build, + Trip, and Tail actions.

## Deploying on Render
This revision requires a **Node Web Service**, not a Static Site, because parsing and live-tail lookup run on backend routes.

`render.yaml` is included. With a GitHub repository connected to Render, create/deploy the Blueprint or web service from the repository.

Build command: `npm install`

Start command: `npm start`

## Data/privacy
Copied FR24 page text is posted to the LineForge server only for the parse request and is not intentionally persisted by the application.

## FR24 September 2026 live-board format

The backend parser supports Flightradar24's newer airport-board copy format where each flight is copied as a vertical block (TIME, FLIGHT, To:/From:, airport IATA/ICAO, airline, aircraft, optional registration, gate/runway, status). It extracts the schedule time, flight number, route, airline, normalized ICAO aircraft type, optional registration, and status. Because the new departures board no longer exposes a scheduled arrival time (and arrivals no longer expose a scheduled departure time), LineForge calculates a provisional opposite endpoint from route distance and aircraft class when airport coordinates are available. Estimated schedule endpoints are displayed with `~` and are planning aids until SimBrief produces a real block time.


## September 11 UI / Safari fixes

- Flight Desk now has one global **Import FR24 clipboard** action instead of duplicate import buttons in both desk panels.
- FR24 links are launched through `free.flightradar24.com` with a real anchor click. This avoids the previous false "Safari blocked" warning caused by `window.open(..., noopener)` returning `null` on iPad Safari even when the tab opened.
- Static assets are served with `no-store` and versioned URLs so Safari does not combine an older cached frontend with a newer backend.
- The clipboard importer validates the server payload before rendering and remains on Flight Desk if parsing fails.
- Tail Finder controls have been reflowed for iPad and explicitly describe registration-country filtering.


## 2.1.0 API routing fix

This build mounts every `/api/*` route before the static app fallback. An API request can no longer be answered with `index.html`.

After Render deploys, open `/api/health` in Safari. A healthy deployment returns JSON similar to:

```json
{"ok":true,"service":"lineforge-dispatch","version":"2.1.0"}
```

The FR24 clipboard parser remains server-side at `POST /api/parse-fr24`.


## v2.2.1 API routing hardening
The clipboard parser is available at `POST /parse-fr24.json` and the deploy health endpoint is `GET /health.json`. These routes are registered before static assets so they cannot intentionally fall through to the SPA shell. The FR24 2026 vertical airport-board parser accepts both full aircraft names and compact FR24 equipment codes, and tolerates rows where aircraft information is omitted.
