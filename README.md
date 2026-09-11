# LineForge Dispatch 2.0

LineForge is a FLICA-style flight-simulation dispatch, pairing, and trip-building web app designed for iPad/Safari and Render.

## What changed in 2.0

- Airport country defaults to **United States**.
- Random airports can be filtered by **large / medium / small**. OpenFlights `airports.dat` remains the base airport database; OurAirports metadata supplies airport size because `airports.dat` itself does not contain a size class.
- FR24 airport and aircraft-history pages open through LineForge's same-origin `/fr24` handoff page. The handoff opens a Safari tab first, then navigates to FR24, avoiding a direct iOS universal-link tap that commonly launches the native FR24 app. iOS can still override browser behavior based on system/user association settings.
- New **Tail Finder** rolls live registrations by ISO country code (default **US**) using OpenSky state vectors and ADSB.lol enrichment. You can choose Auto, OpenSky, or ADSB.lol.
- Parsed flight tables can be filtered by **3-letter airline ICAO**, **aircraft type**, **departure**, and **destination**.
- The project is now a tiny Node/Express Render web service instead of a static site because live surveillance lookup and the Safari-safe FR24 handoff need server routes.

## Deploy on Render

1. Unzip the project and push the `lineforge` folder to a GitHub repository.
2. In Render choose **New Blueprint** and select the repository.
3. Render reads `render.yaml`, runs `npm install`, then starts `node server.js`.
4. Open the Render URL in Safari on the iPad.

No database is required. User settings, holding legs, and the trip board remain in browser `localStorage`.

### Optional OpenSky credentials

Anonymous OpenSky requests can be rate-limited. For more reliable Tail Finder requests, create an OpenSky API client and add these Render environment variables:

- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`

LineForge automatically uses OAuth client credentials when both are present.

## Data sources

- OpenFlights `airports.dat` — airport identity, coordinates, IATA/ICAO, timezone.
- OurAirports `airports.csv` — airport size classification only.
- OpenFlights `airlines.dat` — IATA-to-ICAO airline conversion.
- OpenSky — live state vectors and country of origin.
- ADSB.lol — registration/type/operator enrichment and optional random-tail source.
- Flightradar24 — manually viewed/copy-pasted schedule and aircraft-history data. LineForge does not scrape FR24.

## Core workflow

1. Roll/search an airport.
2. Open FR24 Arrivals or Departures in Safari.
3. Copy visible FR24 page text.
4. Paste and parse it in LineForge.
5. Filter the table as needed.
6. Build in SimBrief, add the leg to a trip, or open its tail history.
7. Alternatively use Tail Finder to roll a live registration and jump directly to its FR24 history page.

## Notes

- FR24 times are stored exactly as pasted; set FR24 to UTC/Zulu.
- Duty/FDP bars are simulation planning aids, not regulatory legality determinations.
- HAZMAT/DG remarks are simulation-only formatting aids.
