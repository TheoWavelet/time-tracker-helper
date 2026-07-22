import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, isNull, max } from 'drizzle-orm'
import { getDb } from '../connection'
import { tags, timers } from '../schema'
import type { TagDTO, TagPickerEntry } from '@shared/types'

function mapRow(row: typeof tags.$inferSelect): TagDTO {
  return {
    id: row.id,
    label: row.label,
    targetUrl: row.targetUrl,
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export function listTags(): TagDTO[] {
  const rows = getDb()
    .select()
    .from(tags)
    .where(isNull(tags.archivedAt))
    .orderBy(desc(tags.isFavorite), tags.label)
    .all()
  return rows.map(mapRow)
}

export function listTagsForPicker(): TagPickerEntry[] {
  const rows = getDb()
    .select({
      id: tags.id,
      label: tags.label,
      targetUrl: tags.targetUrl,
      isFavorite: tags.isFavorite,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      usageCount: count(timers.id),
      lastUsedAt: max(timers.updatedAt)
    })
    .from(tags)
    .leftJoin(timers, eq(timers.tagId, tags.id))
    .where(isNull(tags.archivedAt))
    .groupBy(tags.id)
    .orderBy(desc(tags.isFavorite), tags.label)
    .all()
  return rows.map((row) => ({ ...row, lastUsedAt: row.lastUsedAt ?? null }))
}

export function findTagByLabel(label: string): TagDTO | null {
  const row = getDb()
    .select()
    .from(tags)
    .where(and(eq(tags.label, label), isNull(tags.archivedAt)))
    .get()
  return row ? mapRow(row) : null
}

export function findOrCreateTagByLabel(label: string): TagDTO {
  const trimmed = label.trim()
  const existing = findTagByLabel(trimmed)
  if (existing) return existing

  const now = Date.now()
  const id = randomUUID()
  getDb()
    .insert(tags)
    .values({ id, label: trimmed, targetUrl: null, isFavorite: false, createdAt: now, updatedAt: now })
    .run()

  return { id, label: trimmed, targetUrl: null, isFavorite: false, createdAt: now, updatedAt: now }
}
