import { getDb } from '../connection';
function mapRow(row) {
    return {
        id: row.id,
        title: row.title,
        kind: row.kind,
        status: row.status,
        tagId: row.tag_id,
        tagLabel: row.tag_label,
        startedAt: row.started_at,
        currentSegmentStartedAt: row.current_segment_started_at,
        accumulatedMs: row.accumulated_ms,
        stoppedAt: row.stopped_at,
        submittedAt: row.submitted_at,
        discardedAt: row.discarded_at,
        note: row.note,
        pausedReason: row.paused_reason,
        switchedToTitle: row.switched_to_title,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
const SELECT = `
  SELECT t.*, g.label AS tag_label
  FROM timers t
  LEFT JOIN tags g ON g.id = t.tag_id
`;
export function listTimers() {
    const rows = getDb().prepare(`${SELECT} ORDER BY t.updated_at DESC`).all();
    return rows.map(mapRow);
}
export function findRunningTimer() {
    const row = getDb().prepare(`${SELECT} WHERE t.status = 'running'`).get();
    return row ? mapRow(row) : null;
}
export function findTimerById(id) {
    const row = getDb().prepare(`${SELECT} WHERE t.id = ?`).get(id);
    return row ? mapRow(row) : null;
}
export function insertTimer(input) {
    const now = Date.now();
    getDb()
        .prepare(`INSERT INTO timers
         (id, title, kind, status, tag_id, started_at, current_segment_started_at, accumulated_ms, created_at, updated_at)
       VALUES
         (@id, @title, @kind, 'running', @tagId, @startedAt, @startedAt, 0, @now, @now)`)
        .run({ ...input, now });
}
export function pauseTimerRow(id, reason, switchedToTitle) {
    const now = Date.now();
    getDb()
        .prepare(`UPDATE timers
       SET accumulated_ms = accumulated_ms + (@now - current_segment_started_at),
           current_segment_started_at = NULL,
           status = 'paused',
           paused_reason = @reason,
           switched_to_title = @switchedToTitle,
           updated_at = @now
       WHERE id = @id AND status = 'running'`)
        .run({ id, reason, switchedToTitle, now });
}
export function resumeTimerRow(id) {
    const now = Date.now();
    getDb()
        .prepare(`UPDATE timers
       SET status = 'running',
           current_segment_started_at = @now,
           paused_reason = NULL,
           switched_to_title = NULL,
           updated_at = @now
       WHERE id = @id`)
        .run({ id, now });
}
export function stopTimerRow(id) {
    const now = Date.now();
    const db = getDb();
    const row = db.prepare('SELECT current_segment_started_at FROM timers WHERE id = ?').get(id);
    if (!row)
        return;
    if (row.current_segment_started_at != null) {
        db.prepare(`UPDATE timers
       SET accumulated_ms = accumulated_ms + (@now - current_segment_started_at),
           current_segment_started_at = NULL,
           status = 'stopped',
           stopped_at = @now,
           updated_at = @now
       WHERE id = @id`).run({ id, now });
    }
    else {
        db.prepare(`UPDATE timers SET status = 'stopped', stopped_at = @now, updated_at = @now WHERE id = @id`).run({
            id,
            now
        });
    }
}
export function submitTimerRow(id, tagId) {
    const now = Date.now();
    getDb()
        .prepare(`UPDATE timers SET status = 'submitted', tag_id = @tagId, submitted_at = @now, updated_at = @now WHERE id = @id`)
        .run({ id, tagId, now });
}
export function discardTimerRow(id) {
    const now = Date.now();
    getDb()
        .prepare(`UPDATE timers SET status = 'discarded', discarded_at = @now, updated_at = @now WHERE id = @id`)
        .run({ id, now });
}
export function updateTimerTitle(id, title) {
    getDb()
        .prepare(`UPDATE timers SET title = @title, updated_at = @now WHERE id = @id`)
        .run({ id, title, now: Date.now() });
}
export function assignTimerTag(id, tagId) {
    getDb()
        .prepare(`UPDATE timers SET tag_id = @tagId, updated_at = @now WHERE id = @id`)
        .run({ id, tagId, now: Date.now() });
}
