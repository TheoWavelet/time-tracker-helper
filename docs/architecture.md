# Project Architecture

This is a desktop time-tracking app built with Electron, React, TypeScript, SQLite, and a small Chrome extension. If you know React, the main new concept is that the UI does not directly access desktop APIs or the database.

## The Three Electron Contexts

```text
React renderer (overlay/dashboard)
  -> preload bridge (window.api)
  -> Electron IPC
  -> main process (application logic)
  -> SQLite / Windows APIs / browser extension
```

### Renderer: React UI

The renderer is the browser-like environment where React runs. This project has two separate renderer apps:

- `src/renderer/overlay`: the always-on-top timer bar and expandable panel.
- `src/renderer/dashboard`: settings, browser pairing, and timer history.
- `src/renderer/components`: React components and hooks shared by both windows.

Renderer code should behave like normal browser code: render state, respond to input, and call approved `window.api` methods. It should not open SQLite or use Node's filesystem APIs.

### Preload: the safe bridge

Each window has a preload script in `src/preload`. It exposes a small API to React using `contextBridge`:

```ts
window.api.timers.start({ title: 'Review pull request' })
```

That call is defined in the preload script and sends an Electron IPC request. React cannot call arbitrary Node or Electron APIs because the window is configured with `nodeIntegration: false` and `contextIsolation: true`.

### Main process: application controller

`src/main/index.ts` starts the desktop application. The main process can create windows, work with the system tray, show notifications, read OS idle time, use Node packages, and access SQLite.

It composes these focused modules:

| Location | Responsibility |
| --- | --- |
| `timerStore.ts` | Timer rules, transactions, and timer-change notifications. |
| `settingsStore.ts` | Persisted user settings through `electron-store`. |
| `idleMonitor.ts` | Pauses a running timer after OS-level inactivity. |
| `tray.ts` | Windows system tray icon and context menu. |
| `browserBridge.ts` | Local WebSocket connection to the Chrome extension. |
| `windows/` | Creates and controls the overlay and dashboard windows. |
| `ipc/` | Thin handlers that connect preload requests to main-process operations. |
| `db/` | SQLite connection, migrations, schema definitions, and queries. |

## Follow One Action: Start a Timer

This is the most useful end-to-end path to understand:

1. A React component calls `window.api.timers.start(input)`.
2. `src/preload/overlay.ts` or `src/preload/dashboard.ts` translates it into `ipcRenderer.invoke('timers:start', input)`.
3. `src/main/ipc/timers.ipc.ts` receives the named request and calls `timerStore.startTimer(input)`.
4. `src/main/timerStore.ts` applies business rules: it pauses another active timer, finds or creates a tag, and creates the new timer.
5. `src/main/db/repositories/timers.repo.ts` writes the database rows.
6. `timerStore` emits a fresh timer snapshot.
7. The IPC module broadcasts `timers:changed` to every open Electron window.
8. Each React app receives the snapshot through `window.api.timers.onChanged(...)`, updates state, and rerenders.

The main process is the source of truth. Both renderer windows render snapshots sent from it.

## How Timer Time Is Calculated

The database does not update once per second. A timer stores:

- `accumulatedMs`: completed tracking time from earlier segments.
- `currentSegmentStartedAt`: timestamp for the currently running segment, or `null` when paused.

While running, the UI calculates:

```text
elapsed = accumulatedMs + (Date.now() - currentSegmentStartedAt)
```

When paused or stopped, the repository adds the current segment to `accumulatedMs` and clears `currentSegmentStartedAt`. This makes time tracking accurate without constant database writes.

## SQLite and Drizzle

SQLite is a database stored in one file on the user's machine, rather than a separate database server. The file is created in Electron's user-data directory as `timetracker.db`.

`src/main/db/connection.ts` opens the connection, enables foreign keys and write-ahead logging, then runs pending migrations. Drizzle is the typed query builder used by repositories; it lets TypeScript describe queries without manually concatenating SQL strings.

### Tables

| Table | Purpose |
| --- | --- |
| `timers` | Timer details, status, elapsed-time segments, and optional tag link. |
| `tags` | Reusable labels, favorite state, and optional browser target URL. |
| `links` | Related URL, file, or application links for a timer. |

`src/main/db/schema.ts` is Drizzle's TypeScript description of those tables. The actual database-definition source is the numbered SQL files in `src/main/db/migrations`.

## Migrations: Changing Stored Data Safely

A migration is a permanent, versioned database change. Existing users may already have an older database, so do not edit an old migration after it has been released.

To add a persistent field:

1. Add a new numbered SQL file such as `0003_add_timer_project.sql`.
2. Register it in the `MIGRATIONS` array in `src/main/db/connection.ts`.
3. Add the matching column to `src/main/db/schema.ts`.
4. Update affected repository reads and writes.
5. Update `src/shared/types.ts` if renderer code needs the field.
6. Update `timerStore` and React UI as needed.

SQLite records the applied migration number in `PRAGMA user_version`, so each migration runs exactly once per local database.

Use a transaction when several writes must succeed or fail together. For example, starting a timer pauses the old running timer and inserts the new one in one transaction. If the insert fails, SQLite rolls back the pause as well.

## IPC Contract Changes

Adding a main-process action normally requires four changes:

1. Implement the action in `src/main`, usually in `timerStore.ts` or another owner module.
2. Register an IPC handler in the matching `src/main/ipc/*.ipc.ts` file.
3. Expose a narrowly typed method from both relevant preload scripts.
4. Call that method from React through `window.api`.

Do not expose generic filesystem, database, or shell APIs to React. Expose specific operations such as `exportCsv()` or `openTimerLink(url)` and validate their inputs in the main process.

## Browser Extension Bridge

The Manifest V3 extension in `browser-extension/` connects to the desktop app over a local WebSocket on `127.0.0.1:51834`.

- Electron hosts the WebSocket server because Chrome extensions cannot accept incoming connections.
- The extension authenticates with a pairing token stored by the app.
- `browserBridge.ts` asks the connected extension for open tabs and domain-filtered history.
- React receives those results through normal preload and IPC methods.

The pairing token is deliberately separate from general settings because it is only needed by the browser bridge.

## Development Guide

Run the app with:

```bash
npm install
npm run dev
```

React and CSS edits under `src/renderer` hot reload. Changes under `src/main` or `src/preload` require restarting Electron.

Run a production build with:

```bash
npm run build
```

The build script cleans and recreates `.tsbuild` and `out` files. This repository currently tracks those generated files, so build output can appear in `git status`; that is unrelated to source changes.

Recommended reading order:

1. `src/renderer/overlay/src/App.tsx`
2. `src/preload/overlay.ts`
3. `src/main/ipc/timers.ipc.ts`
4. `src/main/timerStore.ts`
5. `src/main/db/repositories/timers.repo.ts`
6. `src/main/db/connection.ts`