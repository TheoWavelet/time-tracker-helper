-- Reverts 0006_tag_source_browser.sql — per-tag source-browser auto-detection was replaced by a
-- single user-picked "default link browser" setting instead (see settingsStore.ts).
ALTER TABLE tags DROP COLUMN source_browser;
