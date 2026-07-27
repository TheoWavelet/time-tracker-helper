-- Widens the kind CHECK to allow 'custom_log' (added at the application layer without a matching
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
