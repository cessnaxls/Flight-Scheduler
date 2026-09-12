# LineForge Dispatch v4.0 — On-device FR24 parser

This build deliberately removes FR24 airport-board parsing from the Render HTTP request path. Clipboard text is parsed locally in Safari on the iPad, and only the resulting table is shown. This avoids the repeated Render rewrite/fallback issue that was returning HTML for parser POST requests.

The existing Node Web Service still serves LineForge and handles live-tail provider calls. No Render settings change is required.
