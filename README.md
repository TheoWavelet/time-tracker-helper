# Time Tracker — Dev Setup

Personal Windows time-tracking app: Electron + React + TypeScript, a transparent always-on-top
overlay bar/panel, a dashboard window, and a companion Chrome extension for tagging timers against
open tabs / browser history.

## Documentation

- [Project architecture](docs/architecture.md): how React, Electron, IPC, SQLite, and the browser extension fit together.
- [Electron primer](docs/electron.md): Electron's process model, security boundaries, native capabilities, and useful next features.
- [Windows release guide](docs/release.md): build and distribute the Windows installer and extension archive.
- [Chrome Web Store submission material](docs/chrome-web-store-submission.md): store copy, permission explanations, and privacy policy.

## Prerequisites

- Node.js (developed against v22.x)
- Windows (the overlay, idle detection, and DB path assumptions are Windows-specific)
- Google Chrome (or any Chromium browser) if you want the browser-extension features

## Install & run

```
npm install
npm run dev      # electron-vite dev — launches the app with HMR
npm run build    # tsc --build --clean && electron-vite build
npm test         # vitest
```

**Hot reload notes**: renderer changes (React/CSS under `src/renderer/`) hot-reload live. Changes
to anything in `src/main/` or `src/preload/` do **not** hot-reload — kill all `electron.exe`
processes and restart `npm run dev` for those to take effect. `npm run dev` also holds a single-
instance lock, so if it seems to exit immediately, check whether another dev instance (yours or an
agent's) is already running and holding it.

## Project layout

```
src/main/            Electron main process — windows, IPC handlers, SQLite/Drizzle, timer state
src/main/db/          schema.ts (Drizzle mirror) + migrations/*.sql (actual DDL source of truth)
src/preload/          contextBridge preloads — one per window (dashboard.ts, overlay.ts)
src/renderer/         dashboard/, overlay/ (separate Vite entries), components/ (used by both)
src/shared/           types.ts, format.ts — shared between main and renderer via the @shared alias
browser-extension/    Manifest V3 Chrome extension (loaded unpacked, not built/bundled)
docs/                 architecture and Electron tutorials
```

The three renderer/main/preload TypeScript projects are checked independently:

```
npx tsc --noEmit -p tsconfig.node.json
npx tsc --noEmit -p tsconfig.web.dashboard.json
npx tsc --noEmit -p tsconfig.web.overlay.json
```

## Browser extension setup

The extension reports currently-open Chrome tabs and domain-filtered browsing history to the app
(shown in the tag picker's "Open" and "History" views). It talks to the app over a local WebSocket
(`ws://127.0.0.1:51834`) that the app hosts — the extension is always the connecting client.

1. **Load the extension**: open `chrome://extensions`, enable **Developer mode** (top right), click
   **Load unpacked**, and select the `browser-extension/` folder in this repo.
2. **No pairing step needed**: the app always accepts a fixed constant token (`DEV_PAIRING_TOKEN`
   in `browserBridge.ts`), dev or packaged, and the extension tries that same constant automatically
   whenever it has no token saved — so it just connects on its own. This is deliberately open
   (no secret required) since the WS server only ever listens on `127.0.0.1` for this one app on
   this one machine. If you'd rather require a real per-install token, the dashboard's **Browser
   extension** section still shows one (with a Copy button) that you can paste into the extension's
   options page (`chrome://extensions` → the extension's card → **Details** → **Extension options**)
   — but it's optional now, not required.
3. Within a few seconds the dashboard's status dot should flip from "Not connected" to "Connected"
   (it polls every 3s). If it doesn't, check the extension's service worker console
   (`chrome://extensions` → **service worker** link on the card) for connection errors.

Once connected, open the tag picker (typing into the title/tag field in either the overlay or the
dashboard) — the **Open** button shows live tabs, and the always-visible **History** section shows
matching browsing history. Both are restricted to the **domain filter** setting (default
`atlassian.net`, editable in the same dashboard section) — blank the field to stop filtering.

### Re-loading after extension code changes

Any edit to `browser-extension/*` requires reloading the extension: `chrome://extensions` → click
the refresh icon on the extension's card. Manifest changes (new permissions) may prompt Chrome to
ask you to re-approve them.

### The pairing token itself

It's a random UUID generated on first run and stored via its own `electron-store` file (separate
from the app's regular settings, since it has no reason to reach every window). If you ever need to
reset it, delete `pairingToken` from `%APPDATA%\time-tracking-helper\config\browser-pairing.json`
(exact filename may vary by `electron-store` version) and restart the app — a new one will be
generated on next launch.

## Inspecting the SQLite DB directly

The DB lives at `%APPDATA%\time-tracking-helper\timetracker.db`. `better-sqlite3`'s native binary is
built against Electron's Node ABI, so it can't be opened with a plain `node -e "require('better-
sqlite3')..."` one-liner (ABI mismatch error) while the app itself uses Electron's bundled Node.
Easiest read-only inspection from a plain terminal is Python's built-in `sqlite3` module:

```
python -c "import sqlite3; c = sqlite3.connect('file:%APPDATA%/time-tracking-helper/timetracker.db?mode=ro', uri=True); print(c.execute('PRAGMA user_version').fetchone())"
```

(Expand `%APPDATA%` to its actual path first — the sqlite3 URI form doesn't expand Windows env vars.)
