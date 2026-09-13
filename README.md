# LineForge Dispatch v8.0.0 — Local Clipboard Parser

FR24 clipboard imports are parsed entirely in the browser. The Import/Parse Clipboard button uses `navigator.clipboard.readText()` and immediately converts the copied FR24 departures, arrivals, or aircraft history page into the Flight Results table. No fetch, API parser endpoint, form POST, or backend parser handoff is involved.

Deploy to the existing Render Node Web Service with `npm install` / `npm start`.
