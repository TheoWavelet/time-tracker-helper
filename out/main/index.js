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
const migration0003 = `-- Widens the kind CHECK to allow 'custom_log' (added at the application layer without a matching
-- migration, so every custom-log insert was failing its CHECK constraint) and adds two tracking
-- columns: link_opened_at (has the tag's link ever been opened from history — for the "visited"
-- tint) and logged_confirmed_at (user-ticked "I've logged this somewhere proper" checkbox).
-- SQLite can't ALTER an existing CHECK constraint in place, so this means rebuilding the table.
CREATE TABLE timers_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('one_off', 'persistent', 'custom_log')),
  status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'stopped', 'submitted', 'discarded')),
  tag_id TEXT NULL REFERENCES tags (id),
  started_at INTEGER NOT NULL,
  current_segment_started_at INTEGER NULL,
  accumulated_ms INTEGER NOT NULL DEFAULT 0,
  stopped_at INTEGER NULL,
  submitted_at INTEGER NULL,
  discarded_at INTEGER NULL,
  note TEXT NULL,
  paused_reason TEXT NULL CHECK (paused_reason IN ('manual', 'switched', 'idle')),
  switched_to_title TEXT NULL,
  link_opened_at INTEGER NULL,
  logged_confirmed_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO timers_new (
  id, title, kind, status, tag_id, started_at, current_segment_started_at, accumulated_ms,
  stopped_at, submitted_at, discarded_at, note, paused_reason, switched_to_title, created_at, updated_at
)
SELECT
  id, title, kind, status, tag_id, started_at, current_segment_started_at, accumulated_ms,
  stopped_at, submitted_at, discarded_at, note, paused_reason, switched_to_title, created_at, updated_at
FROM timers;

DROP TABLE timers;
ALTER TABLE timers_new RENAME TO timers;

CREATE INDEX idx_timers_status ON timers (status);
CREATE INDEX idx_timers_tag_id ON timers (tag_id);
`;
const migration0004 = `-- Adds a soft-delete column so "delete" moves a timer to an archive instead of destroying it
-- outright, plus a daily_stats table that permanently records tracked time per calendar day —
-- kept independent of the timers table so clearing the archive (a real, hard delete) never
-- erases past statistics.
ALTER TABLE timers ADD COLUMN archived_at INTEGER NULL;

CREATE TABLE daily_stats (
  date TEXT PRIMARY KEY,
  total_ms INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Backfill from existing history so upgrading doesn't reset stats to zero.
INSERT INTO daily_stats (date, total_ms, updated_at)
SELECT
  date(stopped_at / 1000, 'unixepoch', 'localtime') AS day,
  SUM(accumulated_ms) AS total_ms,
  MAX(updated_at) AS updated_at
FROM timers
WHERE status = 'stopped' AND stopped_at IS NOT NULL
GROUP BY day;
`;
const migration0005 = `-- Auto-derived from a tag's target_url (see tags.repo.ts deriveClockworkIssueKey) whenever a
-- Jira-style issue key like "SSP-13" is found in it — lets timers tagged against a Jira issue
-- sync their tracked time to Clockwork without any new manual data entry.
ALTER TABLE tags ADD COLUMN clockwork_issue_key TEXT NULL;

-- Set once a timer's tracked time has been successfully mirrored to Clockwork (drives the
-- "logged automatically" indicator in history).
ALTER TABLE timers ADD COLUMN clockwork_logged_at INTEGER NULL;
`;
const migration0006 = "-- Records which browser a tag's target_url was originally picked from (see\n-- tags.repo.ts / browserBridge.ts), so history can reopen the link in that same browser instead\n-- of always falling back to the OS default browser.\nALTER TABLE tags ADD COLUMN source_browser TEXT NULL;\n";
const migration0007 = '-- Reverts 0006_tag_source_browser.sql — per-tag source-browser auto-detection was replaced by a\n-- single user-picked "default link browser" setting instead (see settingsStore.ts).\nALTER TABLE tags DROP COLUMN source_browser;\n';
const MIGRATIONS = [
  { version: 1, sql: migration0001 },
  { version: 2, sql: migration0002 },
  { version: 3, sql: migration0003 },
  { version: 4, sql: migration0004 },
  { version: 5, sql: migration0005 },
  { version: 6, sql: migration0006 },
  { version: 7, sql: migration0007 }
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
  /** Auto-derived from targetUrl (see tags.repo.ts) — drives automatic Clockwork time sync. */
  clockworkIssueKey: sqliteCore.text("clockwork_issue_key"),
  createdAt: sqliteCore.integer("created_at").notNull(),
  updatedAt: sqliteCore.integer("updated_at").notNull()
});
const timers = sqliteCore.sqliteTable("timers", {
  id: sqliteCore.text("id").primaryKey(),
  title: sqliteCore.text("title").notNull(),
  kind: sqliteCore.text("kind", { enum: ["one_off", "persistent", "custom_log"] }).notNull(),
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
  linkOpenedAt: sqliteCore.integer("link_opened_at"),
  loggedConfirmedAt: sqliteCore.integer("logged_confirmed_at"),
  archivedAt: sqliteCore.integer("archived_at"),
  /** Set once this timer's time has been successfully mirrored to Clockwork. */
  clockworkLoggedAt: sqliteCore.integer("clockwork_logged_at"),
  createdAt: sqliteCore.integer("created_at").notNull(),
  updatedAt: sqliteCore.integer("updated_at").notNull()
});
const dailyStats = sqliteCore.sqliteTable("daily_stats", {
  date: sqliteCore.text("date").primaryKey(),
  totalMs: sqliteCore.integer("total_ms").notNull(),
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
const JIRA_ISSUE_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/;
function deriveClockworkIssueKey(targetUrl) {
  if (!targetUrl) return null;
  const match = targetUrl.match(JIRA_ISSUE_KEY_PATTERN);
  return match ? match[1] : null;
}
function mapRow$1(row) {
  return {
    id: row.id,
    label: row.label,
    targetUrl: row.targetUrl,
    isFavorite: row.isFavorite,
    clockworkIssueKey: row.clockworkIssueKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
function listTags$1() {
  const rows = getDb().select().from(tags).where(drizzleOrm.isNull(tags.archivedAt)).orderBy(drizzleOrm.desc(tags.isFavorite), tags.label).all();
  return rows.map(mapRow$1);
}
function listTagsForPicker$1() {
  const rows = getDb().select({
    id: tags.id,
    label: tags.label,
    targetUrl: tags.targetUrl,
    isFavorite: tags.isFavorite,
    clockworkIssueKey: tags.clockworkIssueKey,
    createdAt: tags.createdAt,
    updatedAt: tags.updatedAt,
    usageCount: drizzleOrm.count(timers.id),
    lastUsedAt: drizzleOrm.max(timers.updatedAt)
  }).from(tags).leftJoin(timers, drizzleOrm.eq(timers.tagId, tags.id)).where(drizzleOrm.isNull(tags.archivedAt)).groupBy(tags.id).orderBy(drizzleOrm.desc(tags.isFavorite), tags.label).all();
  return rows.map((row) => ({ ...row, lastUsedAt: row.lastUsedAt ?? null }));
}
function findTagByLabel(label) {
  const row = getDb().select().from(tags).where(drizzleOrm.and(drizzleOrm.eq(tags.label, label), drizzleOrm.isNull(tags.archivedAt))).get();
  return row ? mapRow$1(row) : null;
}
function findTagById(id) {
  const row = getDb().select().from(tags).where(drizzleOrm.eq(tags.id, id)).get();
  return row ? mapRow$1(row) : null;
}
function findOrCreateTagByLabel(label) {
  const trimmed = label.trim();
  const existing = findTagByLabel(trimmed);
  if (existing) return existing;
  const now = Date.now();
  const id = node_crypto.randomUUID();
  getDb().insert(tags).values({ id, label: trimmed, targetUrl: null, isFavorite: false, clockworkIssueKey: null, createdAt: now, updatedAt: now }).run();
  return { id, label: trimmed, targetUrl: null, isFavorite: false, clockworkIssueKey: null, createdAt: now, updatedAt: now };
}
function findOrCreateTagByLabelAndUrl$1(label, url) {
  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();
  const existing = findTagByLabel(trimmedLabel);
  if (existing) {
    if (!existing.targetUrl) {
      getDb().update(tags).set({ targetUrl: trimmedUrl, clockworkIssueKey: deriveClockworkIssueKey(trimmedUrl), updatedAt: Date.now() }).where(drizzleOrm.eq(tags.id, existing.id)).run();
    }
  } else {
    const now = Date.now();
    getDb().insert(tags).values({
      id: node_crypto.randomUUID(),
      label: trimmedLabel,
      targetUrl: trimmedUrl,
      isFavorite: false,
      clockworkIssueKey: deriveClockworkIssueKey(trimmedUrl),
      createdAt: now,
      updatedAt: now
    }).run();
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
function backfillClockworkIssueKeys() {
  const rows = getDb().select({ id: tags.id, targetUrl: tags.targetUrl }).from(tags).where(drizzleOrm.and(drizzleOrm.isNull(tags.clockworkIssueKey))).all();
  for (const row of rows) {
    const derived = deriveClockworkIssueKey(row.targetUrl);
    if (derived) {
      getDb().update(tags).set({ clockworkIssueKey: derived }).where(drizzleOrm.eq(tags.id, row.id)).run();
    }
  }
}
const timerWithTag = { timer: timers, tagLabel: tags.label, tagTargetUrl: tags.targetUrl };
function mapRow(row) {
  return { ...row.timer, tagLabel: row.tagLabel, tagTargetUrl: row.tagTargetUrl };
}
function listTimers() {
  const rows = getDb().select(timerWithTag).from(timers).leftJoin(tags, drizzleOrm.eq(tags.id, timers.tagId)).where(drizzleOrm.isNull(timers.archivedAt)).orderBy(drizzleOrm.desc(timers.startedAt)).all();
  return rows.map(mapRow);
}
function listArchivedTimers$1() {
  const rows = getDb().select(timerWithTag).from(timers).leftJoin(tags, drizzleOrm.eq(tags.id, timers.tagId)).where(drizzleOrm.isNotNull(timers.archivedAt)).orderBy(drizzleOrm.desc(timers.archivedAt)).all();
  return rows.map(mapRow);
}
function findRunningTimer() {
  const row = getDb().select(timerWithTag).from(timers).leftJoin(tags, drizzleOrm.eq(tags.id, timers.tagId)).where(drizzleOrm.eq(timers.status, "running")).get();
  return row ? mapRow(row) : null;
}
function findTimerById(id) {
  const row = getDb().select(timerWithTag).from(timers).leftJoin(tags, drizzleOrm.eq(tags.id, timers.tagId)).where(drizzleOrm.eq(timers.id, id)).get();
  return row ? mapRow(row) : null;
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
function insertCustomTimerLog(input) {
  getDb().insert(timers).values({
    id: input.id,
    title: input.title,
    kind: "custom_log",
    status: "paused",
    pausedReason: "manual",
    tagId: input.tagId,
    startedAt: input.loggedAt,
    currentSegmentStartedAt: null,
    accumulatedMs: input.durationMs,
    createdAt: input.loggedAt,
    updatedAt: input.loggedAt
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
function markTimerLinkOpened$1(id) {
  const now = Date.now();
  getDb().update(timers).set({ linkOpenedAt: now, updatedAt: now }).where(drizzleOrm.eq(timers.id, id)).run();
}
function markClockworkLogged(id) {
  getDb().update(timers).set({ clockworkLoggedAt: Date.now() }).where(drizzleOrm.eq(timers.id, id)).run();
}
function toggleTimerLoggedConfirmed$1(id) {
  const current = getDb().select({ loggedConfirmedAt: timers.loggedConfirmedAt }).from(timers).where(drizzleOrm.eq(timers.id, id)).get();
  if (!current) return;
  const now = Date.now();
  getDb().update(timers).set({ loggedConfirmedAt: current.loggedConfirmedAt == null ? now : null, updatedAt: now }).where(drizzleOrm.eq(timers.id, id)).run();
}
function setTimersLoggedConfirmed$1(ids, confirmed) {
  if (ids.length === 0) return;
  const now = Date.now();
  const db2 = getDb();
  for (const id of ids) {
    db2.update(timers).set({ loggedConfirmedAt: confirmed ? now : null, updatedAt: now }).where(drizzleOrm.eq(timers.id, id)).run();
  }
}
function archiveTimerRow(id) {
  const now = Date.now();
  getDb().update(timers).set({ archivedAt: now, updatedAt: now }).where(drizzleOrm.eq(timers.id, id)).run();
}
function clearArchive$1() {
  getDb().delete(timers).where(drizzleOrm.isNotNull(timers.archivedAt)).run();
}
function addTrackedMs(dateKey, ms) {
  const now = Date.now();
  getRawSqlite().prepare(
    `INSERT INTO daily_stats (date, total_ms, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET total_ms = total_ms + excluded.total_ms, updated_at = excluded.updated_at`
  ).run(dateKey, ms, now);
}
function getTrackedMsForDates(dateKeys) {
  if (dateKeys.length === 0) return /* @__PURE__ */ new Map();
  const rows = getDb().select().from(dailyStats).where(drizzleOrm.inArray(dailyStats.date, dateKeys)).all();
  return new Map(rows.map((row) => [row.date, row.totalMs]));
}
const DAY_MS = 24 * 60 * 60 * 1e3;
function startOfDay(timestamp) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(timestamp) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}
function localDateKey(timestamp) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function recordTrackedTime(finishedAt, ms) {
  if (ms <= 0) return;
  addTrackedMs(localDateKey(finishedAt), ms);
}
function getWeeklyStats(now = Date.now()) {
  const weekStart = startOfWeek(now);
  const todayStart = startOfDay(now);
  const dayStarts = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY_MS);
  const dateKeys = dayStarts.map(localDateKey);
  const totals = getTrackedMsForDates(dateKeys);
  const days = dayStarts.map((dayStart, i) => ({
    label: new Date(dayStart).toLocaleDateString("en-US", { weekday: "short" }),
    totalMs: totals.get(dateKeys[i]) ?? 0,
    isFuture: dayStart > todayStart
  }));
  const elapsedDays = Math.floor((todayStart - weekStart) / DAY_MS) + 1;
  const totalMs = days.reduce((sum, d) => sum + d.totalMs, 0);
  const dailyAverageMs = totalMs / Math.max(1, elapsedDays);
  return { days, totalMs, dailyAverageMs };
}
const store$1 = new Store({ name: "clockwork-credentials" });
function getClockworkApiToken() {
  return store$1.get("apiToken") ?? null;
}
function setClockworkApiToken(token) {
  const trimmed = token.trim();
  if (trimmed) store$1.set("apiToken", trimmed);
  else store$1.delete("apiToken");
}
function hasClockworkApiToken() {
  return getClockworkApiToken() != null;
}
const CLOCKWORK_API_BASE = "https://api.clockwork.report/v1";
const REQUEST_TIMEOUT_MS$1 = 8e3;
async function callClockwork(path2, issueKey) {
  const token = getClockworkApiToken();
  if (!token) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS$1);
  try {
    const response = await fetch(`${CLOCKWORK_API_BASE}${path2}?issue_key=${encodeURIComponent(issueKey)}`, {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
      signal: controller.signal
    });
    if (!response.ok) {
      console.error(`Clockwork API ${path2} failed for ${issueKey}: HTTP ${response.status}`);
    }
    return response.ok;
  } catch (error) {
    console.error(`Clockwork API ${path2} failed for ${issueKey}`, error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
function startClockworkTimer(issueKey) {
  return callClockwork("/start_timer", issueKey);
}
function stopClockworkTimer(issueKey) {
  return callClockwork("/stop_timer", issueKey);
}
const defaults = {
  dockSide: "right",
  dockYOffset: null,
  highlightPausedTimers: false,
  browserDomainFilter: "atlassian.net",
  // Off by default even once a token is set — this pushes real time entries to a shared work
  // system, so it should be a deliberate opt-in rather than switching on the moment a token exists.
  clockworkSyncEnabled: false,
  defaultLinkBrowser: "chrome"
};
const store = new Store({ defaults });
function getSettings() {
  return {
    dockSide: store.get("dockSide"),
    dockYOffset: store.get("dockYOffset"),
    highlightPausedTimers: store.get("highlightPausedTimers"),
    browserDomainFilter: store.get("browserDomainFilter"),
    clockworkSyncEnabled: store.get("clockworkSyncEnabled"),
    defaultLinkBrowser: store.get("defaultLinkBrowser")
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
function setClockworkSyncEnabled(value) {
  store.set("clockworkSyncEnabled", value);
  return getSettings();
}
function setDefaultLinkBrowser(value) {
  store.set("defaultLinkBrowser", value);
  return getSettings();
}
const activeMirrors = /* @__PURE__ */ new Map();
const unreliableTimerIds = /* @__PURE__ */ new Set();
function isSyncActive() {
  return getSettings().clockworkSyncEnabled && hasClockworkApiToken();
}
function resolveIssueKey(tagId) {
  if (!tagId) return null;
  return findTagById(tagId)?.clockworkIssueKey ?? null;
}
async function notifyTimerRunning(timerId, tagId) {
  if (!isSyncActive()) return;
  const issueKey = resolveIssueKey(tagId);
  if (!issueKey) return;
  const ok = await startClockworkTimer(issueKey);
  if (ok) activeMirrors.set(issueKey, timerId);
  else unreliableTimerIds.add(timerId);
}
async function notifyTimerSegmentEnded(timerId, tagId) {
  const issueKey = resolveIssueKey(tagId);
  if (!issueKey || activeMirrors.get(issueKey) !== timerId) return;
  activeMirrors.delete(issueKey);
  const ok = await stopClockworkTimer(issueKey);
  if (!ok) unreliableTimerIds.add(timerId);
}
async function notifyTimerSaved(timerId, tagId) {
  if (!isSyncActive()) return false;
  const issueKey = resolveIssueKey(tagId);
  if (!issueKey) return false;
  if (activeMirrors.get(issueKey) === timerId) {
    activeMirrors.delete(issueKey);
    const ok = await stopClockworkTimer(issueKey);
    if (!ok) unreliableTimerIds.add(timerId);
  }
  const reliable = !unreliableTimerIds.has(timerId);
  unreliableTimerIds.delete(timerId);
  return reliable;
}
async function stopAllActiveMirrors() {
  const issueKeys = Array.from(activeMirrors.keys());
  activeMirrors.clear();
  await Promise.all(issueKeys.map((key) => stopClockworkTimer(key)));
}
async function reconcileOnStartup() {
  if (!isSyncActive()) return;
  const running = listTimers().find((t) => t.status === "running");
  if (!running) return;
  await notifyTimerRunning(running.id, running.tagId);
}
function startClockworkSync() {
  void reconcileOnStartup();
  let quitting = false;
  electron.app.on("before-quit", (event) => {
    if (quitting || activeMirrors.size === 0) return;
    event.preventDefault();
    quitting = true;
    void stopAllActiveMirrors().finally(() => electron.app.quit());
  });
  electron.powerMonitor.on("suspend", () => void stopAllActiveMirrors());
  electron.powerMonitor.on("lock-screen", () => void stopAllActiveMirrors());
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
  let previousRunning;
  const newId = sqlite2.transaction(() => {
    const running = findRunningTimer();
    if (running) {
      pauseTimerRow(running.id, "switched", title);
      previousRunning = { id: running.id, tagId: running.tagId };
    }
    const tagId = input.tagLabel?.trim() ? findOrCreateTagByLabel(input.tagLabel).id : null;
    const id = node_crypto.randomUUID();
    insertTimer({ id, title, kind: input.kind ?? "persistent", tagId, startedAt: now });
    return id;
  })();
  emitChange();
  const created = findTimerById(newId);
  if (!created) throw new Error("Timer disappeared immediately after creation");
  if (previousRunning) void notifyTimerSegmentEnded(previousRunning.id, previousRunning.tagId);
  void notifyTimerRunning(created.id, created.tagId);
  return created;
}
function createCustomTimerLog(input) {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 24 * 60) {
    throw new Error("Custom log duration must be a whole number between 1 and 1,440 minutes");
  }
  const sqlite2 = getRawSqlite();
  const loggedAt = Date.now();
  const title = input.title?.trim() || formatDefaultTimerTitle(loggedAt);
  const id = sqlite2.transaction(() => {
    const tagId = input.tagLabel?.trim() ? findOrCreateTagByLabel(input.tagLabel).id : null;
    const customLogId = node_crypto.randomUUID();
    insertCustomTimerLog({
      id: customLogId,
      title,
      tagId,
      durationMs: input.durationMinutes * 6e4,
      loggedAt
    });
    return customLogId;
  })();
  emitChange();
  const created = findTimerById(id);
  if (!created) throw new Error("Custom log disappeared immediately after creation");
  return created;
}
function pauseTimer(id) {
  const timer = findTimerById(id);
  pauseTimerRow(id, "manual", null);
  emitChange();
  void notifyTimerSegmentEnded(id, timer?.tagId ?? null);
}
function pauseTimerForIdle(id, endAt) {
  const timer = findTimerById(id);
  pauseTimerRow(id, "idle", null, endAt);
  emitChange();
  void notifyTimerSegmentEnded(id, timer?.tagId ?? null);
}
function resumeTimer(id) {
  const sqlite2 = getRawSqlite();
  let previousRunning;
  const target = sqlite2.transaction(() => {
    const running = findRunningTimer();
    const target2 = findTimerById(id);
    if (running && running.id !== id) {
      pauseTimerRow(running.id, "switched", target2?.title ?? null);
      previousRunning = { id: running.id, tagId: running.tagId };
    }
    resumeTimerRow(id);
    return target2;
  })();
  emitChange();
  if (previousRunning) void notifyTimerSegmentEnded(previousRunning.id, previousRunning.tagId);
  void notifyTimerRunning(id, target?.tagId ?? null);
}
function stopTimer(id) {
  stopTimerRow(id);
  const stopped = findTimerById(id);
  if (stopped && stopped.stoppedAt != null) {
    recordTrackedTime(stopped.stoppedAt, stopped.accumulatedMs);
  }
  emitChange();
  if (stopped) {
    void notifyTimerSaved(id, stopped.tagId).then((logged) => {
      if (logged) {
        markClockworkLogged(id);
        emitChange();
      }
    });
  }
}
function deleteTimer(id) {
  archiveTimerRow(id);
  emitChange();
}
function listArchivedTimers() {
  return listArchivedTimers$1();
}
function clearArchive() {
  clearArchive$1();
}
function updateTimerTitle(id, title) {
  updateTimerTitle$1(id, title);
  emitChange();
}
function markTimerLinkOpened(id) {
  markTimerLinkOpened$1(id);
  emitChange();
}
function toggleTimerLoggedConfirmed(id) {
  toggleTimerLoggedConfirmed$1(id);
  emitChange();
}
function setTimersLoggedConfirmed(ids, confirmed) {
  setTimersLoggedConfirmed$1(ids, confirmed);
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
  electron.ipcMain.handle("timers:createCustomLog", (_event, input) => createCustomTimerLog(input));
  electron.ipcMain.handle("timers:pause", (_event, id) => pauseTimer(id));
  electron.ipcMain.handle("timers:resume", (_event, id) => resumeTimer(id));
  electron.ipcMain.handle("timers:stop", (_event, id) => stopTimer(id));
  electron.ipcMain.handle("timers:delete", (_event, id) => deleteTimer(id));
  electron.ipcMain.handle(
    "timers:updateTitle",
    (_event, { id, title }) => updateTimerTitle(id, title)
  );
  electron.ipcMain.handle("timers:markLinkOpened", (_event, id) => markTimerLinkOpened(id));
  electron.ipcMain.handle("timers:toggleLoggedConfirmed", (_event, id) => toggleTimerLoggedConfirmed(id));
  electron.ipcMain.handle(
    "timers:setLoggedConfirmed",
    (_event, ids, confirmed) => setTimersLoggedConfirmed(ids, confirmed)
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
  electron.ipcMain.handle("tags:findOrCreateByLabelAndUrl", (_event, label, url) => findOrCreateTagByLabelAndUrl(label, url));
  electron.ipcMain.handle("tags:toggleFavorite", (_event, id) => toggleTagFavorite(id));
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
  electron.ipcMain.handle("settings:setClockworkSyncEnabled", (_event, value) => {
    const updated = setClockworkSyncEnabled(value);
    broadcastSettings();
    return updated;
  });
  electron.ipcMain.handle("settings:setDefaultLinkBrowser", (_event, value) => {
    const updated = setDefaultLinkBrowser(value);
    broadcastSettings();
    return updated;
  });
}
function registerShellIpc() {
  electron.ipcMain.handle("shell:openExternal", (_event, url) => electron.shell.openExternal(url));
}
const PORT = 51834;
const REQUEST_TIMEOUT_MS = 2e3;
const DEV_PAIRING_TOKEN = "dev-pairing-token-insecure-local-only";
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
  wss.on("error", (error) => {
    console.error(`Browser extension bridge could not listen on 127.0.0.1:${PORT}`, error);
    wss?.close();
    wss = null;
  });
  wss.on("connection", (socket) => {
    socket.once("message", (data) => {
      let first;
      try {
        first = JSON.parse(data.toString());
      } catch {
        socket.close();
        return;
      }
      const isAuthorized = first.type === "auth" && (first.token === DEV_PAIRING_TOKEN || first.token === getOrCreatePairingToken());
      if (!isAuthorized) {
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
let lastKnownHistory = null;
async function searchHistoryByDomain(domain) {
  const result = await sendRequest("searchHistoryByDomain", { domain });
  const items = result?.items;
  if (items) {
    lastKnownHistory = { domain, items };
    return items;
  }
  if (lastKnownHistory && lastKnownHistory.domain === domain) return lastKnownHistory.items;
  return [];
}
function registerBrowserIpc() {
  electron.ipcMain.handle("browser:listOpenTabs", () => listOpenTabs(getSettings().browserDomainFilter));
  electron.ipcMain.handle("browser:searchHistoryByDomain", () => searchHistoryByDomain(getSettings().browserDomainFilter));
  electron.ipcMain.handle("browser:getPairingInfo", () => ({
    token: getPairingToken(),
    connected: isExtensionConnected()
  }));
}
function registerArchiveIpc() {
  electron.ipcMain.handle("archive:list", () => listArchivedTimers());
  electron.ipcMain.handle("archive:clear", () => clearArchive());
  electron.ipcMain.handle("stats:getWeekly", () => getWeeklyStats());
}
function registerClockworkIpc() {
  electron.ipcMain.handle("clockwork:getStatus", () => ({ hasToken: hasClockworkApiToken() }));
  electron.ipcMain.handle("clockwork:setApiToken", (_event, token) => {
    setClockworkApiToken(token);
    return { hasToken: hasClockworkApiToken() };
  });
}
const BAR_WIDTH = 88;
const BAR_WIDE_WIDTH = BAR_WIDTH * 4;
const BAR_ROW_HEIGHT = 44;
const SEE_MORE_HEIGHT = 36;
const PANEL_SIZE = { width: 320, height: 440 };
const EDGE_MARGIN = 8;
const MOVE_SAVE_DEBOUNCE_MS = 300;
const RESIZE_ANIMATION_MS = 140;
const RESIZE_ANIMATION_STEP_MS = 8;
let overlayWindow = null;
let expanded = false;
let barWide = false;
let activeTimerCount = 0;
let moveSaveTimer = null;
let dragActive = false;
let dragAnchorCursorY = 0;
let dragAnchorWindowY = 0;
let resizeAnimationTimer = null;
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
function animateBoundsTo(target) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (resizeAnimationTimer) {
    clearInterval(resizeAnimationTimer);
    resizeAnimationTimer = null;
  }
  const start = overlayWindow.getBounds();
  const startedAt = Date.now();
  resizeAnimationTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      if (resizeAnimationTimer) clearInterval(resizeAnimationTimer);
      resizeAnimationTimer = null;
      return;
    }
    const t = Math.min(1, (Date.now() - startedAt) / RESIZE_ANIMATION_MS);
    const eased = easeOutCubic(t);
    overlayWindow.setBounds({
      x: Math.round(start.x + (target.x - start.x) * eased),
      y: Math.round(start.y + (target.y - start.y) * eased),
      width: Math.round(start.width + (target.width - start.width) * eased),
      height: Math.round(start.height + (target.height - start.height) * eased)
    });
    if (t >= 1 && resizeAnimationTimer) {
      clearInterval(resizeAnimationTimer);
      resizeAnimationTimer = null;
    }
  }, RESIZE_ANIMATION_STEP_MS);
}
function collapsedHeight(workAreaHeight) {
  const rowCount = Math.max(1, activeTimerCount);
  const desired = BAR_ROW_HEIGHT * rowCount + Math.max(0, rowCount - 1) + SEE_MORE_HEIGHT;
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
  const target = computeBounds(dockSide, expanded, dockYOffset);
  if (dragActive) {
    overlayWindow.setBounds(target);
    return;
  }
  animateBoundsTo(target);
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
  if (resizeAnimationTimer) {
    clearInterval(resizeAnimationTimer);
    resizeAnimationTimer = null;
  }
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
let dashboardWindow = null;
let isQuitting = false;
electron.app.on("before-quit", () => {
  isQuitting = true;
});
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
    if (!isQuitting) {
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
let statsWindow = null;
function createStatsWindow() {
  if (statsWindow && !statsWindow.isDestroyed()) return statsWindow;
  statsWindow = new electron.BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 420,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/stats.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  statsWindow.on("ready-to-show", () => statsWindow?.show());
  statsWindow.on("closed", () => {
    statsWindow = null;
  });
  statsWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    statsWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/stats/`);
  } else {
    statsWindow.loadFile(path.join(__dirname, "../renderer/stats/index.html"));
  }
  return statsWindow;
}
function showStatsWindow() {
  const win = createStatsWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function registerStatsWindowIpc() {
  electron.ipcMain.handle("stats:show", () => showStatsWindow());
}
let tray = null;
function createTrayIcon() {
  const filename = process.platform === "win32" ? "icon.ico" : "tray-icon.png";
  const iconPath = electron.app.isPackaged ? path.join(process.resourcesPath, filename) : path.join(electron.app.getAppPath(), "build", filename);
  return electron.nativeImage.createFromPath(iconPath);
}
function createTray() {
  tray = new electron.Tray(createTrayIcon());
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
electron.app.disableHardwareAcceleration();
const gotSingleInstanceLock = electron.app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  electron.app.quit();
} else {
  electron.app.setAppUserModelId("com.timetrackinghelper.app");
  electron.app.on("second-instance", () => {
    showDashboardWindow();
  });
  electron.app.whenReady().then(() => {
    getDb();
    backfillClockworkIssueKeys();
    registerTimerIpc();
    registerTagsIpc();
    registerSettingsIpc(applyDockSide);
    registerOverlayIpc();
    registerShellIpc();
    registerDashboardIpc();
    registerBrowserIpc();
    registerArchiveIpc();
    registerStatsWindowIpc();
    registerClockworkIpc();
    createOverlayWindow();
    createTray();
    startIdleMonitor();
    startBrowserBridge();
    startClockworkSync();
    setActiveTimerCount(countActiveTimers(getSnapshot()));
    onTimersChanged((snapshot) => {
      refreshTrayMenu();
      setActiveTimerCount(countActiveTimers(snapshot));
    });
  });
  electron.app.on("window-all-closed", () => {
  });
}
