# Windows Release Guide

## Prerequisites

- Node.js 22.x on Windows.
- Install dependencies with `npm install`.
- A production Windows icon is still required for a polished release. Add a multi-resolution
  `build/icon.ico` and set `build.win.icon` in `package.json`; until then, the installer uses the
  default Electron icon.

## Build Release Files

Set the desktop version in `package.json` and the extension version in
`browser-extension/manifest.json`. Build both distributables:

```powershell
npm run dist
npm run package:extension
```

The generated release files are in `release/`:

- `Time-Tracker-<version>-Setup.exe`: per-user, interactive NSIS installer for 64-bit Windows.
- `time-tracker-bridge-<version>.zip`: Chrome extension archive with `manifest.json` at its root.
- `latest.yml` and the installer `.blockmap`: retain these with the installer if an update feed is
  added later.

The installer is intentionally unsigned. Windows may show reputation warnings until code signing
is introduced.

## Release Checks

Install the generated EXE on a machine where the app has not previously run. Confirm that the
overlay, dashboard, tray actions, timer persistence after restart, and browser pairing all work.
The installer rebuilds the `better-sqlite3` native binary for Electron and unpacks it from ASAR.

For the extension, upload the generated ZIP to an existing Chrome Web Store listing. The first
submission also needs the store listing, privacy policy, screenshots, and permission
justifications for `tabs`, `history`, and `storage`. Keep publishing from the same listing so
users receive automatic browser updates and retain their extension identity.

## Distribution

Share the desktop installer directly from a trusted download location. The extension is easiest
to install and update through the Chrome Web Store; developer-mode loading is appropriate only
for local development. The desktop application does not yet check for or download updates, so
publish each installer version through the chosen download channel. For local development, load
`browser-extension/` unpacked via `chrome://extensions` (Developer mode → Load unpacked) — no
packing or registry setup needed.