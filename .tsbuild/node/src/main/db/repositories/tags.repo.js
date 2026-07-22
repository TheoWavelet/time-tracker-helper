import { randomUUID } from 'node:crypto';
import { getDb } from '../connection';
function mapRow(row) {
    return {
        id: row.id,
        label: row.label,
        targetUrl: row.target_url,
        isFavorite: row.is_favorite === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
export function listTags() {
    const rows = getDb()
        .prepare(`SELECT * FROM tags WHERE archived_at IS NULL ORDER BY is_favorite DESC, label ASC`)
        .all();
    return rows.map(mapRow);
}
export function findTagByLabel(label) {
    const row = getDb().prepare(`SELECT * FROM tags WHERE label = ? AND archived_at IS NULL`).get(label);
    return row ? mapRow(row) : null;
}
export function findOrCreateTagByLabel(label) {
    const trimmed = label.trim();
    const existing = findTagByLabel(trimmed);
    if (existing)
        return existing;
    const now = Date.now();
    const id = randomUUID();
    getDb()
        .prepare(`INSERT INTO tags (id, label, target_url, is_favorite, created_at, updated_at)
       VALUES (@id, @label, NULL, 0, @now, @now)`)
        .run({ id, label: trimmed, now });
    return { id, label: trimmed, targetUrl: null, isFavorite: false, createdAt: now, updatedAt: now };
}
