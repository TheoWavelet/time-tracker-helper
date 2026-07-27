-- Adds a soft-delete column so "delete" moves a timer to an archive instead of destroying it
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
