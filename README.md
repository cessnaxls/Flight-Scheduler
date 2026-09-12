# LineForge Dispatch v4.1.0

This build fixes the blank-screen regression by abandoning the generated/embedded monolith. The UI is once again normal static assets (`public/index.html`, `public/app.js`, `public/styles.css`) served by a tiny zero-dependency Node server.

FR24 airport-board parsing remains entirely on-device in Safari. The Node server is used only to serve the app and for live-tail lookup.

## Render
- Runtime: Node
- Build command: `echo "No dependencies to install"`
- Start command: `node server.js`
- Health check: `/health`
