-- Auto-derived from a tag's target_url (see tags.repo.ts deriveClockworkIssueKey) whenever a
-- Jira-style issue key like "SSP-13" is found in it — lets timers tagged against a Jira issue
-- sync their tracked time to Clockwork without any new manual data entry.
ALTER TABLE tags ADD COLUMN clockwork_issue_key TEXT NULL;

-- Set once a timer's tracked time has been successfully mirrored to Clockwork (drives the
-- "logged automatically" indicator in history).
ALTER TABLE timers ADD COLUMN clockwork_logged_at INTEGER NULL;
