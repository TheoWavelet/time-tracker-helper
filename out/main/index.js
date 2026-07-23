"use strict";
const electron = require("electron");
const path = require("node:path");
const Database = require("better-sqlite3");
const betterSqlite3 = require("drizzle-orm/better-sqlite3");
const node_crypto = require("node:crypto");
const drizzleOrm = require("drizzle-orm");
const sqliteCore = require("drizzle-orm/sqlite-core");
const Store = require("electron-store");
const ws = require("ws");
const migration0001 = "CREATE TABLE tags (\n  id TEXT PRIMARY KEY,\n  label TEXT NOT NULL UNIQUE,\n  target_url TEXT NULL,\n  is_favorite INTEGER NOT NULL DEFAULT 0,\n  archived_at INTEGER NULL,\n  created_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n);\n\nCREATE INDEX idx_tags_is_favorite ON tags (is_favorite);\n\nCREATE TABLE timers (\n  id TEXT PRIMARY KEY,\n  title TEXT NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('one_off', 'persistent')),\n  status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'stopped', 'submitted', 'discarded')),\n  tag_id TEXT NULL REFERENCES tags (id),\n  started_at INTEGER NOT NULL,\n  current_segment_started_at INTEGER NULL,\n  accumulated_ms INTEGER NOT NULL DEFAULT 0,\n  stopped_at INTEGER NULL,\n  submitted_at INTEGER NULL,\n  discarded_at INTEGER NULL,\n  note TEXT NULL,\n  paused_reason TEXT NULL CHECK (paused_reason IN ('manual', 'switched')),\n  switched_to_title TEXT NULL,\n  created_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n);\n\nCREATE INDEX idx_timers_status ON timers (status);\nCREATE INDEX idx_timers_tag_id ON timers (tag_id);\n\nCREATE TABLE links (\n  id TEXT PRIMARY KEY,\n  timer_id TEXT NOT NULL REFERENCES timers (id) ON DELETE CASCADE,\n  link_type TEXT NOT NULL CHECK (link_type IN ('browser_url', 'explorer_path', 'application')),\n  value TEXT NOT NULL,\n  title TEXT NULL,\n  icon TEXT NULL,\n  created_at INTEGER NOT NULL\n);\n\nCREATE INDEX idx_links_timer_id ON links (timer_id);\n";
const migration0002 = "-- SQLite can't ALTER an existing CHECK constraint in place, so allowing paused_reason = 'idle'\n-- (auto-paused by idle detection) means rebuilding the table.\nCREATE TABLE timers_new (\n  id TEXT PRIMARY KEY,\n  title TEXT NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('one_off', 'persistent')),\n  status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'stopped', 'submitted', 'discarded')),\n  tag_id TEXT NULL REFERENCES tags (id),\n  started_at INTEGER NOT NULL,\n  current_segment_started_at INTEGER NULL,\n  accumulated_ms INTEGER NOT NULL DEFAULT 0,\n  stopped_at INTEGER NULL,\n  submitted_at INTEGER NULL,\n  discarded_at INTEGER NULL,\n  note TEXT NULL,\n  paused_reason TEXT NULL CHECK (paused_reason IN ('manual', 'switched', 'idle')),\n  switched_to_title TEXT NULL,\n  created_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n);\n\nINSERT INTO timers_new (\n  id, title, kind, status, tag_id, started_at, current_segment_started_at, accumulated_ms,\n  stopped_at, submitted_at, discarded_at, note, paused_reason, switched_to_title, created_at, updated_at\n)\nSELECT\n  id, title, kind, status, tag_id, started_at, current_segment_started_at, accumulated_ms,\n  stopped_at, submitted_at, discarded_at, note, paused_reason, switched_to_title, created_at, updated_at\nFROM timers;\n\nDROP TABLE timers;\nALTER TABLE timers_new RENAME TO timers;\n\nCREATE INDEX idx_timers_status ON timers (status);\nCREATE INDEX idx_timers_tag_id ON timers (tag_id);\n";
const MIGRATIONS = [
  { version: 1, sql: migration0001 },
  { version: 2, sql: migration0002 }
];
let sqlite = null;
let db = null;
function ensureInitialized() {
  if (sqlite) return;
  const dbPath = path.join(electron.app.getPath("userData"), "timetracker.db");
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  runMigrations(sqlite);
  db = betterSqlite3.drizzle(sqlite);
}
function getDb() {
  ensureInitialized();
  return db;
}
function getRawSqlite() {
  ensureInitialized();
  return sqlite;
}
function runMigrations(database) {
  const currentVersion = database.pragma("user_version", { simple: true });
  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    const applyMigration = database.transaction(() => {
      database.exec(migration.sql);
      database.pragma(`user_version = ${migration.version}`);
    });
    applyMigration();
  }
}
const tags = sqliteCore.sqliteTable("tags", {
  id: sqliteCore.text("id").primaryKey(),
  label: sqliteCore.text("label").notNull(),
  targetUrl: sqliteCore.text("target_url"),
  isFavorite: sqliteCore.integer("is_favorite", { mode: "boolean" }).notNull(),
  archivedAt: sqliteCore.integer("archived_at"),
  createdAt: sqliteCore.integer("created_at").notNull(),
  updatedAt: sqliteCore.integer("updated_at").notNull()
});
const timers = sqliteCore.sqliteTable("timers", {
  id: sqliteCore.text("id").primaryKey(),
  title: sqliteCore.text("title").notNull(),
  kind: sqliteCore.text("kind", { enum: ["one_off", "persistent"] }).notNull(),
  status: sqliteCore.text("status", { enum: ["running", "paused", "stopped", "submitted", "discarded"] }).notNull(),
  tagId: sqliteCore.text("tag_id").references(() => tags.id),
  startedAt: sqliteCore.integer("started_at").notNull(),
  currentSegmentStartedAt: sqliteCore.integer("current_segment_started_at"),
  accumulatedMs: sqliteCore.integer("accumulated_ms").notNull(),
  stoppedAt: sqliteCore.integer("stopped_at"),
  submittedAt: sqliteCore.integer("submitted_at"),
  discardedAt: sqliteCore.integer("discarded_at"),
  note: sqliteCore.text("note"),
  pausedReason: sqliteCore.text("paused_reason", { enum: ["manual", "switched", "idle"] }),
  switchedToTitle: sqliteCore.text("switched_to_title"),
  createdAt: sqliteCore.integer("created_at").notNull(),
  updatedAt: sqliteCore.integer("updated_at").notNull()
});
sqliteCore.sqliteTable("links", {
  id: sqliteCore.text("id").primaryKey(),
  timerId: sqliteCore.text("timer_id").notNull().references(() => timers.id, { onDelete: "cascade" }),
  linkType: sqliteCore.text("link_type", { enum: ["browser_url", "explorer_path", "application"] }).notNull(),
  value: sqliteCore.text("value").notNull(),
  title: sqliteCore.text("title"),
  icon: sqliteCore.text("icon"),
  createdAt: sqliteCore.integer("created_at").notNull()
});
function mapRow$1(row, tagLabel, tagTargetUrl) {
  return { ...row, tagLabel, tagTargetUrl };
}
const timerWithTag = { timer: timers, tagLabel: tags.label, tagTargetUrl: tags.targetUrl };
function listTimers() {
  const rows = getDb().select(timerWithTag).from(timers).leftJoin(tags, drizzleOrm.eq(tags.id, timers.tagId)).orderBy(drizzleOrm.desc(timers.startedAt)).all();
  return rows.map((row) => mapRow$1(row.timer, row.tagLabel, row.tagTargetUrl));
}
function findRunningTimer() {
  const row = getDb().select(timerWithTag).from(timers).leftJoin(tags, drizzleOrm.eq(tags.id, timers.tagId)).where(drizzleOrm.eq(timers.status, "running")).get();
  return row ? mapRow$1(row.timer, row.tagLabel, row.tagTargetUrl) : null;
}
function findTimerById(id) {
  const row = getDb().select(timerWithTag).from(timers).leftJoin(tags, drizzleOrm.eq(tags.id, timers.tagId)).where(drizzleOrm.eq(timers.id, id)).get();
  return row ? mapRow$1(row.timer, row.tagLabel, row.tagTargetUrl) : null;
}
function insertTimer(input) {
  const now = Date.now();
  getDb().insert(timers).values({
    id: input.id,
    title: input.title,
    kind: input.kind,
    status: "running",
    tagId: input.tagId,
    startedAt: input.startedAt,
    currentSegmentStartedAt: input.startedAt,
    accumulatedMs: 0,
    createdAt: now,
    updatedAt: now
  }).run();
}
function pauseTimerRow(id, reason, switchedToTitle, endAt) {
  const now = Date.now();
  const effectiveEnd = endAt ?? now;
  getDb().update(timers).set({
    accumulatedMs: drizzleOrm.sql`${timers.accumulatedMs} + (${effectiveEnd} - ${timers.currentSegmentStartedAt})`,
    currentSegmentStartedAt: null,
    status: "paused",
    pausedReason: reason,
    switchedToTitle,
    updatedAt: now
  }).where(drizzleOrm.and(drizzleOrm.eq(timers.id, id), drizzleOrm.eq(timers.status, "running"))).run();
}
function resumeTimerRow(id) {
  const now = Date.now();
  getDb().update(timers).set({ status: "running", currentSegmentStartedAt: now, pausedReason: null, switchedToTitle: null, updatedAt: now }).where(drizzleOrm.eq(timers.id, id)).run();
}
function stopTimerRow(id) {
  const now = Date.now();
  const db2 = getDb();
  const row = db2.select({ currentSegmentStartedAt: timers.currentSegmentStartedAt }).from(timers).where(drizzleOrm.eq(timers.id, id)).get();
  if (!row) return;
  if (row.currentSegmentStartedAt != null) {
    db2.update(timers).set({
      accumulatedMs: drizzleOrm.sql`${timers.accumulatedMs} + (${now} - ${timers.currentSegmentStartedAt})`,
      currentSegmentStartedAt: null,
      status: "stopped",
      stoppedAt: now,
      updatedAt: now
    }).where(drizzleOrm.eq(timers.id, id)).run();
  } else {
    db2.update(timers).set({ status: "stopped", stoppedAt: now, updatedAt: now }).where(drizzleOrm.eq(timers.id, id)).run();
  }
}
function updateTimerTitle$1(id, title) {
  getDb().update(timers).set({ title, updatedAt: Date.now() }).where(drizzleOrm.eq(timers.id, id)).run();
}
function deleteTimerRow(id) {
  getDb().delete(timers).where(drizzleOrm.eq(timers.id, id)).run();
}
function mapRow(row) {
  return {
    id: row.id,
    label: row.label,
    targetUrl: row.targetUrl,
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
function listTags$1() {
  const rows = getDb().select().from(tags).where(drizzleOrm.isNull(tags.archivedAt)).orderBy(drizzleOrm.desc(tags.isFavorite), tags.label).all();
  return rows.map(mapRow);
}
function listTagsForPicker$1() {
  const rows = getDb().select({
    id: tags.id,
    label: tags.label,
    targetUrl: tags.targetUrl,
    isFavorite: tags.isFavorite,
    createdAt: tags.createdAt,
    updatedAt: tags.updatedAt,
    usageCount: drizzleOrm.count(timers.id),
    lastUsedAt: drizzleOrm.max(timers.updatedAt)
  }).from(tags).leftJoin(timers, drizzleOrm.eq(timers.tagId, tags.id)).where(drizzleOrm.isNull(tags.archivedAt)).groupBy(tags.id).orderBy(drizzleOrm.desc(tags.isFavorite), tags.label).all();
  return rows.map((row) => ({ ...row, lastUsedAt: row.lastUsedAt ?? null }));
}
function findTagByLabel(label) {
  const row = getDb().select().from(tags).where(drizzleOrm.and(drizzleOrm.eq(tags.label, label), drizzleOrm.isNull(tags.archivedAt))).get();
  return row ? mapRow(row) : null;
}
function findOrCreateTagByLabel(label) {
  const trimmed = label.trim();
  const existing = findTagByLabel(trimmed);
  if (existing) return existing;
  const now = Date.now();
  const id = node_crypto.randomUUID();
  getDb().insert(tags).values({ id, label: trimmed, targetUrl: null, isFavorite: false, createdAt: now, updatedAt: now }).run();
  return { id, label: trimmed, targetUrl: null, isFavorite: false, createdAt: now, updatedAt: now };
}
function findOrCreateTagByLabelAndUrl$1(label, url) {
  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();
  const existing = findTagByLabel(trimmedLabel);
  if (existing) {
    if (!existing.targetUrl) {
      getDb().update(tags).set({ targetUrl: trimmedUrl, updatedAt: Date.now() }).where(drizzleOrm.eq(tags.id, existing.id)).run();
    }
  } else {
    const now = Date.now();
    getDb().insert(tags).values({ id: node_crypto.randomUUID(), label: trimmedLabel, targetUrl: trimmedUrl, isFavorite: false, createdAt: now, updatedAt: now }).run();
  }
  const picked = listTagsForPicker$1().find((tag) => tag.label === trimmedLabel);
  if (!picked) throw new Error("Tag disappeared immediately after creation");
  return picked;
}
function toggleTagFavorite$1(id) {
  const current = getDb().select({ isFavorite: tags.isFavorite }).from(tags).where(drizzleOrm.eq(tags.id, id)).get();
  if (!current) throw new Error(`Tag ${id} not found`);
  getDb().update(tags).set({ isFavorite: !current.isFavorite, updatedAt: Date.now() }).where(drizzleOrm.eq(tags.id, id)).run();
  const updated = listTagsForPicker$1().find((tag) => tag.id === id);
  if (!updated) throw new Error("Tag disappeared immediately after update");
  return updated;
}
function formatDefaultTimerTitle(startedAt) {
  const d = new Date(startedAt);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const listeners = /* @__PURE__ */ new Set();
function onTimersChanged(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function emitChange() {
  const snapshot = getSnapshot();
  for (const listener of listeners) listener(snapshot);
}
function getSnapshot() {
  const timers2 = listTimers();
  const running = timers2.find((t) => t.status === "running");
  return { timers: timers2, runningTimerId: running ? running.id : null };
}
function startTimer(input) {
  const sqlite2 = getRawSqlite();
  const now = Date.now();
  const title = input.title?.trim() || formatDefaultTimerTitle(now);
  const newId = sqlite2.transaction(() => {
    const running = findRunningTimer();
    if (running) {
      pauseTimerRow(running.id, "switched", title);
    }
    const tagId = input.tagLabel?.trim() ? findOrCreateTagByLabel(input.tagLabel).id : null;
    const id = node_crypto.randomUUID();
    insertTimer({ id, title, kind: input.kind ?? "persistent", tagId, startedAt: now });
    return id;
  })();
  emitChange();
  const created = findTimerById(newId);
  if (!created) throw new Error("Timer disappeared immediately after creation");
  return created;
}
function pauseTimer(id) {
  pauseTimerRow(id, "manual", null);
  emitChange();
}
function pauseTimerForIdle(id, endAt) {
  pauseTimerRow(id, "idle", null, endAt);
  emitChange();
}
function resumeTimer(id) {
  const sqlite2 = getRawSqlite();
  sqlite2.transaction(() => {
    const running = findRunningTimer();
    const target = findTimerById(id);
    if (running && running.id !== id) {
      pauseTimerRow(running.id, "switched", target?.title ?? null);
    }
    resumeTimerRow(id);
  })();
  emitChange();
}
function stopTimer(id) {
  stopTimerRow(id);
  emitChange();
}
function deleteTimer(id) {
  deleteTimerRow(id);
  emitChange();
}
function updateTimerTitle(id, title) {
  updateTimerTitle$1(id, title);
  emitChange();
}
function listTags() {
  return listTags$1();
}
function listTagsForPicker() {
  return listTagsForPicker$1();
}
function findOrCreateTagByLabelAndUrl(label, url) {
  return findOrCreateTagByLabelAndUrl$1(label, url);
}
function toggleTagFavorite(id) {
  return toggleTagFavorite$1(id);
}
function registerTimerIpc() {
  electron.ipcMain.handle("timers:getSnapshot", () => getSnapshot());
  electron.ipcMain.handle("timers:start", (_event, input) => startTimer(input));
  electron.ipcMain.handle("timers:pause", (_event, id) => pauseTimer(id));
  electron.ipcMain.handle("timers:resume", (_event, id) => resumeTimer(id));
  electron.ipcMain.handle("timers:stop", (_event, id) => stopTimer(id));
  electron.ipcMain.handle("timers:delete", (_event, id) => deleteTimer(id));
  electron.ipcMain.handle(
    "timers:updateTitle",
    (_event, { id, title }) => updateTimerTitle(id, title)
  );
  onTimersChanged((snapshot) => {
    for (const win of electron.BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send("timers:changed", snapshot);
    }
  });
}
function registerTagsIpc() {
  electron.ipcMain.handle("tags:list", () => listTags());
  electron.ipcMain.handle("tags:listForPicker", () => listTagsForPicker());
  electron.ipcMain.handle(
    "tags:findOrCreateByLabelAndUrl",
    (_event, label, url) => findOrCreateTagByLabelAndUrl(label, url)
  );
  electron.ipcMain.handle("tags:toggleFavorite", (_event, id) => toggleTagFavorite(id));
}
const defaults = {
  dockSide: "right",
  dockYOffset: null,
  highlightPausedTimers: true,
  browserDomainFilter: "atlassian.net"
};
const store = new Store({ defaults });
function getSettings() {
  return {
    dockSide: store.get("dockSide"),
    dockYOffset: store.get("dockYOffset"),
    highlightPausedTimers: store.get("highlightPausedTimers"),
    browserDomainFilter: store.get("browserDomainFilter")
  };
}
function setDockSide(dockSide) {
  store.set("dockSide", dockSide);
  return getSettings();
}
function setDockYOffset(dockYOffset) {
  store.set("dockYOffset", dockYOffset);
  return getSettings();
}
function setHighlightPausedTimers(value) {
  store.set("highlightPausedTimers", value);
  return getSettings();
}
function setBrowserDomainFilter(value) {
  store.set("browserDomainFilter", value.trim());
  return getSettings();
}
function broadcastSettings() {
  const settings = getSettings();
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("settings:changed", settings);
  }
}
function registerSettingsIpc(onDockSideChange) {
  electron.ipcMain.handle("settings:get", () => getSettings());
  electron.ipcMain.handle("settings:setDockSide", (_event, dockSide) => {
    const updated = setDockSide(dockSide);
    onDockSideChange(updated.dockSide);
    broadcastSettings();
    return updated;
  });
  electron.ipcMain.handle("settings:setHighlightPausedTimers", (_event, value) => {
    const updated = setHighlightPausedTimers(value);
    broadcastSettings();
    return updated;
  });
  electron.ipcMain.handle("settings:setBrowserDomainFilter", (_event, value) => {
    const updated = setBrowserDomainFilter(value);
    broadcastSettings();
    return updated;
  });
}
function registerShellIpc() {
  electron.ipcMain.handle("shell:openExternal", (_event, url) => electron.shell.openExternal(url));
}
const PORT = 51834;
const REQUEST_TIMEOUT_MS = 2e3;
const pairingStore = new Store({ name: "browser-pairing" });
function getOrCreatePairingToken() {
  let token = pairingStore.get("pairingToken");
  if (!token) {
    token = node_crypto.randomUUID();
    pairingStore.set("pairingToken", token);
  }
  return token;
}
let wss = null;
let authenticatedSocket = null;
const pendingRequests = /* @__PURE__ */ new Map();
function handleAuthenticatedMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (!message.requestId) return;
  const resolve = pendingRequests.get(message.requestId);
  if (!resolve) return;
  pendingRequests.delete(message.requestId);
  resolve(message);
}
function startBrowserBridge() {
  if (wss) return;
  wss = new ws.WebSocketServer({ host: "127.0.0.1", port: PORT });
  wss.on("connection", (socket) => {
    socket.once("message", (data) => {
      let first;
      try {
        first = JSON.parse(data.toString());
      } catch {
        socket.close();
        return;
      }
      if (first.type !== "auth" || first.token !== getOrCreatePairingToken()) {
        socket.close();
        return;
      }
      authenticatedSocket = socket;
      socket.on("message", (msg) => handleAuthenticatedMessage(msg.toString()));
    });
    socket.on("close", () => {
      if (authenticatedSocket === socket) authenticatedSocket = null;
    });
  });
}
function isExtensionConnected() {
  return authenticatedSocket !== null && authenticatedSocket.readyState === ws.WebSocket.OPEN;
}
function getPairingToken() {
  return getOrCreatePairingToken();
}
function sendRequest(type, params = {}) {
  return new Promise((resolve) => {
    if (!authenticatedSocket || authenticatedSocket.readyState !== ws.WebSocket.OPEN) {
      resolve(null);
      return;
    }
    const requestId = node_crypto.randomUUID();
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      resolve(null);
    }, REQUEST_TIMEOUT_MS);
    pendingRequests.set(requestId, (message) => {
      clearTimeout(timeout);
      resolve(message);
    });
    authenticatedSocket.send(JSON.stringify({ type, requestId, ...params }));
  });
}
async function listOpenTabs(domain) {
  const result = await sendRequest("listTabs", { domain });
  return result?.tabs ?? [];
}
async function searchHistoryByDomain(domain) {
  const result = await sendRequest("searchHistoryByDomain", { domain });
  return result?.items ?? [];
}
function registerBrowserIpc() {
  electron.ipcMain.handle("browser:listOpenTabs", () => listOpenTabs(getSettings().browserDomainFilter));
  electron.ipcMain.handle("browser:searchHistoryByDomain", () => searchHistoryByDomain(getSettings().browserDomainFilter));
  electron.ipcMain.handle("browser:getPairingInfo", () => ({
    token: getPairingToken(),
    connected: isExtensionConnected()
  }));
}
const BAR_WIDTH = 88;
const BAR_WIDE_WIDTH = BAR_WIDTH * 4;
const BAR_ROW_HEIGHT = 40;
const SEE_MORE_HEIGHT = 18;
const PANEL_SIZE = { width: 320, height: 440 };
const EDGE_MARGIN = 8;
const MOVE_SAVE_DEBOUNCE_MS = 300;
let overlayWindow = null;
let expanded = false;
let barWide = false;
let activeTimerCount = 0;
let moveSaveTimer = null;
let dragActive = false;
let dragAnchorCursorY = 0;
let dragAnchorWindowY = 0;
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function collapsedHeight(workAreaHeight) {
  const desired = BAR_ROW_HEIGHT * Math.max(1, activeTimerCount) + SEE_MORE_HEIGHT;
  return Math.min(desired, workAreaHeight - 2 * EDGE_MARGIN);
}
function currentSize(workAreaHeight, isExpanded) {
  if (isExpanded) return PANEL_SIZE;
  return { width: barWide ? BAR_WIDE_WIDTH : BAR_WIDTH, height: collapsedHeight(workAreaHeight) };
}
function xForDockSide(dockSide, workAreaX, workAreaWidth, width) {
  return dockSide === "left" ? workAreaX + EDGE_MARGIN : workAreaX + workAreaWidth - width - EDGE_MARGIN;
}
function computeBounds(dockSide, isExpanded, dockYOffset) {
  const display = electron.screen.getPrimaryDisplay();
  const { x: wx, y: wy, width: ww, height: wh } = display.workArea;
  const size = currentSize(wh, isExpanded);
  const x = xForDockSide(dockSide, wx, ww, size.width);
  const y = dockYOffset != null ? clamp(wy + dockYOffset, wy, wy + wh - size.height) : wy + Math.round((wh - size.height) / 2);
  return { x, y, width: size.width, height: size.height };
}
function repositionOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const { dockSide, dockYOffset } = getSettings();
  overlayWindow.setBounds(computeBounds(dockSide, expanded, dockYOffset));
}
function scheduleSaveOfDraggedPosition() {
  if (expanded || !overlayWindow || overlayWindow.isDestroyed()) return;
  if (moveSaveTimer) clearTimeout(moveSaveTimer);
  moveSaveTimer = setTimeout(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    const { y: wy } = electron.screen.getPrimaryDisplay().workArea;
    setDockYOffset(overlayWindow.getBounds().y - wy);
  }, MOVE_SAVE_DEBOUNCE_MS);
}
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
  const { dockSide, dockYOffset } = getSettings();
  const bounds = computeBounds(dockSide, false, dockYOffset);
  overlayWindow = new electron.BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/overlay.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.on("ready-to-show", () => overlayWindow?.show());
  overlayWindow.on("move", scheduleSaveOfDraggedPosition);
  if (process.env["ELECTRON_RENDERER_URL"]) {
    overlayWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/overlay/`);
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../renderer/overlay/index.html"));
  }
  electron.screen.on("display-metrics-changed", repositionOverlay);
  electron.screen.on("display-added", repositionOverlay);
  electron.screen.on("display-removed", repositionOverlay);
  return overlayWindow;
}
function setOverlayExpanded(next) {
  expanded = next;
  barWide = false;
  repositionOverlay();
}
function applyDockSide(_dockSide) {
  repositionOverlay();
}
function setActiveTimerCount(count) {
  if (count === activeTimerCount) return;
  activeTimerCount = count;
  repositionOverlay();
}
function setBarWide(wide) {
  if (wide === barWide || expanded) return;
  barWide = wide;
  repositionOverlay();
}
function dragStart() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  dragActive = true;
  dragAnchorCursorY = electron.screen.getCursorScreenPoint().y;
  dragAnchorWindowY = overlayWindow.getBounds().y;
}
function dragUpdate() {
  if (!dragActive || !overlayWindow || overlayWindow.isDestroyed()) return;
  const { dockSide } = getSettings();
  const { x: wx, y: wy, width: ww, height: wh } = electron.screen.getPrimaryDisplay().workArea;
  const size = currentSize(wh, expanded);
  const x = xForDockSide(dockSide, wx, ww, size.width);
  const cursorY = electron.screen.getCursorScreenPoint().y;
  const newY = clamp(dragAnchorWindowY + (cursorY - dragAnchorCursorY), wy, wy + wh - size.height);
  overlayWindow.setBounds({ x, y: newY, width: size.width, height: size.height });
}
function dragEnd() {
  dragActive = false;
}
function registerOverlayIpc() {
  electron.ipcMain.handle("overlay:setExpanded", (_event, next) => {
    setOverlayExpanded(next);
    return next;
  });
  electron.ipcMain.handle("overlay:setBarWide", (_event, wide) => {
    setBarWide(wide);
    return wide;
  });
  electron.ipcMain.on("overlay:dragStart", () => dragStart());
  electron.ipcMain.on("overlay:dragMove", () => dragUpdate());
  electron.ipcMain.on("overlay:dragEnd", () => dragEnd());
}
let quitting = false;
function isQuitting() {
  return quitting;
}
function setQuitting(value) {
  quitting = value;
}
let dashboardWindow = null;
function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) return dashboardWindow;
  dashboardWindow = new electron.BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/dashboard.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  dashboardWindow.on("ready-to-show", () => dashboardWindow?.show());
  dashboardWindow.on("close", (event) => {
    if (!isQuitting()) {
      event.preventDefault();
      dashboardWindow?.hide();
    }
  });
  dashboardWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    dashboardWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/dashboard/`);
  } else {
    dashboardWindow.loadFile(path.join(__dirname, "../renderer/dashboard/index.html"));
  }
  return dashboardWindow;
}
function showDashboardWindow() {
  const win = createDashboardWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function registerDashboardIpc() {
  electron.ipcMain.handle("dashboard:show", () => showDashboardWindow());
}
let tray = null;
function createPlaceholderIcon() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4;
    buffer[offset] = 11;
    buffer[offset + 1] = 158;
    buffer[offset + 2] = 245;
    buffer[offset + 3] = 255;
  }
  return electron.nativeImage.createFromBitmap(buffer, { width: size, height: size });
}
function createTray() {
  tray = new electron.Tray(createPlaceholderIcon());
  tray.setToolTip("Time Tracker");
  tray.on("click", () => showDashboardWindow());
  refreshTrayMenu();
  return tray;
}
function refreshTrayMenu() {
  if (!tray) return;
  const snapshot = getSnapshot();
  const running = snapshot.timers.find((t) => t.id === snapshot.runningTimerId) ?? null;
  const menu = electron.Menu.buildFromTemplate([
    { label: "Open Dashboard", click: () => showDashboardWindow() },
    { type: "separator" },
    running ? { label: `Pause "${running.title}"`, click: () => pauseTimer(running.id) } : { label: "No timer running", enabled: false },
    { type: "separator" },
    {
      label: "Quit Time Tracker",
      click: () => {
        setQuitting(true);
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}
const POLL_INTERVAL_MS = 15e3;
const IDLE_PAUSE_THRESHOLD_SECONDS = 10 * 60;
let pollTimer = null;
function checkIdle() {
  const running = getSnapshot().timers.find((t) => t.status === "running");
  if (!running) return;
  const idleSeconds = electron.powerMonitor.getSystemIdleTime();
  if (idleSeconds < IDLE_PAUSE_THRESHOLD_SECONDS) return;
  const pausedAt = Date.now() - idleSeconds * 1e3;
  pauseTimerForIdle(running.id, pausedAt);
  new electron.Notification({
    title: "Timer paused",
    body: `"${running.title}" was paused after ${Math.round(IDLE_PAUSE_THRESHOLD_SECONDS / 60)} minutes of inactivity.`
  }).show();
}
function startIdleMonitor() {
  if (pollTimer) return;
  pollTimer = setInterval(checkIdle, POLL_INTERVAL_MS);
}
function countActiveTimers(snapshot) {
  return snapshot.timers.filter((t) => t.status === "running" || t.status === "paused").length;
}
const gotSingleInstanceLock = electron.app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", () => {
    showDashboardWindow();
  });
  electron.app.whenReady().then(() => {
    getDb();
    registerTimerIpc();
    registerTagsIpc();
    registerSettingsIpc(applyDockSide);
    registerOverlayIpc();
    registerShellIpc();
    registerDashboardIpc();
    registerBrowserIpc();
    createOverlayWindow();
    createTray();
    startIdleMonitor();
    startBrowserBridge();
    setActiveTimerCount(countActiveTimers(getSnapshot()));
    onTimersChanged((snapshot) => {
      refreshTrayMenu();
      setActiveTimerCount(countActiveTimers(snapshot));
    });
  });
  electron.app.on("before-quit", () => setQuitting(true));
  electron.app.on("window-all-closed", () => {
  });
}
