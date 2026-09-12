# LineForge Dispatch v5.0

Self-contained deployment build. The server reads `public/index.html`, `public/styles.css`, and `public/app.js` at startup and injects CSS and JavaScript directly into the HTML response. This removes separate browser asset-loading/caching as a possible blank-screen cause.

FR24 clipboard parsing occurs locally in Safari; the backend is used for live-tail lookup only.

Diagnostics:
- `/health`
- `/diagnostic`
