-- Records which browser a tag's target_url was originally picked from (see
-- tags.repo.ts / browserBridge.ts), so history can reopen the link in that same browser instead
-- of always falling back to the OS default browser.
ALTER TABLE tags ADD COLUMN source_browser TEXT NULL;
