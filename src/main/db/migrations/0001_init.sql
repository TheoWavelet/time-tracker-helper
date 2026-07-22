CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  target_url TEXT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_tags_is_favorite ON tags (is_favorite);

CREATE TABLE timers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('one_off', 'persistent')),
  status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'stopped', 'submitted', 'discarded')),
  tag_id TEXT NULL REFERENCES tags (id),
  started_at INTEGER NOT NULL,
  current_segment_started_at INTEGER NULL,
  accumulated_ms INTEGER NOT NULL DEFAULT 0,
  stopped_at INTEGER NULL,
  submitted_at INTEGER NULL,
  discarded_at INTEGER NULL,
  note TEXT NULL,
  paused_reason TEXT NULL CHECK (paused_reason IN ('manual', 'switched')),
  switched_to_title TEXT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_timers_status ON timers (status);
CREATE INDEX idx_timers_tag_id ON timers (tag_id);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  timer_id TEXT NOT NULL REFERENCES timers (id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('browser_url', 'explorer_path', 'application')),
  value TEXT NOT NULL,
  title TEXT NULL,
  icon TEXT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_links_timer_id ON links (timer_id);
