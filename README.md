# LineForge Dispatch v7.0.0 — Form-POST Import

This build uses a deliberately different FR24 import architecture for iPad Safari.

## What changed

The clipboard import does **not** use `fetch()`, JSON, `/api/*`, `/parse`, or any other API-style endpoint.

When you tap **Import FR24 clipboard**:

1. Safari reads the clipboard as a direct result of your button tap.
2. LineForge places that text into an invisible standard HTML form.
3. The browser submits the whole document with `POST /`.
4. `server.js` parses the FR24 text on the backend.
5. The server returns a fresh HTML document with the parsed flights embedded.
6. The page opens directly on **Flight Results**.

This is intentionally old-school. It bypasses the exact failure mode where Render/Safari returned `index.html` with status 200 to API requests. Here, receiving HTML is expected.

The existing random airport, tail finder, Build, Holding Area, Trip Board, settings, and filtering functions remain in the app.

## Render

Use the existing Node Web Service. Push these files to the repository root and redeploy. No new service is required.
