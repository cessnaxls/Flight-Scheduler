# LineForge Dispatch v6.0

Fresh rebuild. No frontend build system and no npm dependencies.

Render:
- Runtime: Node
- Build command: `echo "No build step"`
- Start command: `node server.js`
- Health: `/health`

The FR24 clipboard parser runs locally in Safari. Live-tail lookup uses a small server endpoint because provider CORS varies.
