# Electron Primer

Electron builds desktop apps with web technologies. It packages Chromium for rendering HTML/CSS/React and Node.js for desktop and operating-system work, then produces a Windows, macOS, or Linux application.

## Process Model

Electron is not one JavaScript runtime. It has separate processes with separate responsibilities:

```text
Main process: app lifecycle, windows, filesystem, native APIs, background work
Renderer process: React UI inside each BrowserWindow
Preload script: controlled bridge between renderer and main process
```

The main process is similar to a local backend. A renderer is similar to a browser page. They communicate through Electron IPC rather than direct imports.

## Main Process Capabilities

Main-process code can use Node.js and Electron APIs to:

- Create, hide, resize, and focus windows.
- Build transparent, frameless, always-on-top overlays.
- Use the system tray and native application menus.
- Show native notifications.
- Read/write local files and open save/open dialogs.
- Access the clipboard and launch URLs or local files.
- Register global keyboard shortcuts.
- Detect idle time, machine lock, sleep, resume, and shutdown events.
- Start at login.
- Start local servers, such as this project's WebSocket bridge.
- Use native Node modules, including SQLite drivers.
- Register custom application links such as `timetracker://start?title=Planning`.

## Security Model

The convenient but unsafe approach is giving a renderer unrestricted Node access. Do not do that for app windows that render React content:

```ts
// Avoid this configuration.
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false
}
```

Use a preload bridge instead:

```ts
contextBridge.exposeInMainWorld('api', {
  timers: {
    pause: (id: string) => ipcRenderer.invoke('timers:pause', id)
  }
})
```

The renderer gets exactly one useful capability, rather than Node, SQLite, filesystem, and shell access. Validate IPC inputs in the main process too: renderer input should be treated like input from an untrusted client.

## IPC Patterns

Use request/response IPC when React needs a result:

```ts
// Renderer through preload
const report = await window.api.reports.create()

// Main process
ipcMain.handle('reports:create', () => createReport())
```

Use events when the main process needs to push changes to all windows:

```ts
mainWindow.webContents.send('timers:changed', snapshot)
```

For this project, `invoke/handle` is used for timer actions and `timers:changed` broadcasts fresh state to the overlay and dashboard.

## Useful Features for This App

### Global shortcuts

Allow timer control without focusing the app:

```ts
globalShortcut.register('CommandOrControl+Shift+T', () => {
  toggleActiveTimer()
})
```

Always unregister shortcuts when quitting, and choose combinations that do not collide with common applications.

### Native export dialog

Use `dialog.showSaveDialog()` to let a user select where a generated CSV report should go. The main process then writes it with Node's filesystem APIs and can call `shell.showItemInFolder()` afterward.

### System state handling

`powerMonitor` can emit `suspend`, `resume`, `lock-screen`, and `unlock-screen`. The current idle monitor already checks OS input inactivity; handling suspend and lock events could make timer accounting more precise.

### Startup at login

`app.setLoginItemSettings({ openAtLogin: true })` can make the time tracker available after Windows login. Pair it with a user-controlled setting.

### Deep links

Register a protocol such as `timetracker://`. A browser extension, another app, or a command-line script could then launch a prefilled timer. For a single-instance app, handle the URL in Electron's `second-instance` event and focus the existing window.

### Context menus and application menus

Electron supports native menus for timer actions, exports, and settings. This is a natural extension of the existing tray menu.

### Auto-updates

Electron apps can download signed releases and prompt for restart. The project already has `electron-updater` installed, but a real update flow also needs packaging configuration, code signing, and a release host.

## Background and CPU-Heavy Work

Keep main-process work responsive. A long computation can freeze window management, menus, and IPC handling. Small SQLite operations are fine. For expensive reporting, sync, encryption, image processing, or imports, use a Node worker thread, Electron utility process, or child process.

## Packaging

During development, `electron-vite` runs the main process and Vite renderer server. Production packaging is conceptually:

```text
TypeScript source -> electron-vite bundle -> electron-builder installer
```

Electron applications are larger than native apps because they ship Chromium and Node.js. The tradeoff is consistent web rendering and a large JavaScript/Node ecosystem across supported desktop platforms.

## When Electron Is a Good Fit

Electron is a strong fit when you want React development speed and need desktop-only features such as a system tray app, transparent overlay, native idle detection, local database, browser bridge, and filesystem access. This project is a good example of that combination.