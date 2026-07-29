import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, isNotNull, isNull, max } from 'drizzle-orm'
import { getDb } from '../connection'
import { tags, timers } from '../schema'
import type { TagDTO, TagPickerEntry } from '@shared/types'

// Jira issue keys are a project key (2+ letters/digits, starting with a letter) plus a hyphen and
// a number, e.g. "SSP-13".
const JIRA_ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/
// Matches a classic Jira "browse" URL, e.g. https://foo.atlassian.net/browse/SSP-13(/anything).
const JIRA_BROWSE_PATH_PATTERN = /\/browse\/([A-Z][A-Z0-9]+-\d+)(?:[/?#]|$)/

/**
 * Deliberately conservative: earlier this scanned the whole URL for anything shaped like
 * "LETTERS-NUMBER" anywhere in it, which false-positived constantly on ordinary web pages (version
 * strings like "UTF-8", article slugs, tracking IDs, ...) and made completely unrelated pages show
 * up as "logged automatically." Only two structures actually mean "this URL points at a Jira issue":
 * a /browse/KEY path segment, or a query param whose value IS an issue key (not just contains one).
 */
export function deriveClockworkIssueKey(targetUrl: string | null): string | null {
  if (!targetUrl) return null

  const browseMatch = targetUrl.match(JIRA_BROWSE_PATH_PATTERN)
  if (browseMatch) return browseMatch[1]

  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return null
  }
  for (const value of parsed.searchParams.values()) {
    if (JIRA_ISSUE_KEY_PATTERN.test(value)) return value
  }
  return null
}

function mapRow(row: typeof tags.$inferSelect): TagDTO {
  return {
    id: row.id,
    label: row.label,
    targetUrl: row.targetUrl,
    isFavorite: row.isFavorite,
    clockworkIssueKey: row.clockworkIssueKey,
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
      clockworkIssueKey: tags.clockworkIssueKey,
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

export function findTagById(id: string): TagDTO | null {
  const row = getDb().select().from(tags).where(eq(tags.id, id)).get()
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
    .values({ id, label: trimmed, targetUrl: null, isFavorite: false, clockworkIssueKey: null, createdAt: now, updatedAt: now })
    .run()

  return { id, label: trimmed, targetUrl: null, isFavorite: false, clockworkIssueKey: null, createdAt: now, updatedAt: now }
}

/**
 * Used when picking a browser tab or history entry in the tag picker. Existing tags win by label
 * (same lookup as findOrCreateTagByLabel) — a blank target_url gets backfilled to the picked URL,
 * but an existing different target_url is left alone rather than silently overwriting it. Either
 * way, the Clockwork issue key is *re-derived* (not trusted from whatever's already stored) from
 * whatever target_url ends up set — this is what self-heals a tag that got mis-tagged by an older,
 * looser version of deriveClockworkIssueKey the moment it's picked again, rather than needing to
 * wait for the next app restart's backfillClockworkIssueKeys() pass.
 */
export function findOrCreateTagByLabelAndUrl(label: string, url: string): TagPickerEntry {
  const trimmedLabel = label.trim()
  const trimmedUrl = url.trim()
  const existing = findTagByLabel(trimmedLabel)

  if (existing) {
    const effectiveUrl = existing.targetUrl || trimmedUrl
    const derivedIssueKey = deriveClockworkIssueKey(effectiveUrl)
    if (!existing.targetUrl || derivedIssueKey !== existing.clockworkIssueKey) {
      getDb()
        .update(tags)
        .set({ targetUrl: effectiveUrl, clockworkIssueKey: derivedIssueKey, updatedAt: Date.now() })
        .where(eq(tags.id, existing.id))
        .run()
    }
  } else {
    const now = Date.now()
    getDb()
      .insert(tags)
      .values({
        id: randomUUID(),
        label: trimmedLabel,
        targetUrl: trimmedUrl,
        isFavorite: false,
        clockworkIssueKey: deriveClockworkIssueKey(trimmedUrl),
        createdAt: now,
        updatedAt: now
      })
      .run()
  }

  const picked = listTagsForPicker().find((tag) => tag.label === trimmedLabel)
  if (!picked) throw new Error('Tag disappeared immediately after creation')
  return picked
}

export function toggleTagFavorite(id: string): TagPickerEntry {
  const current = getDb().select({ isFavorite: tags.isFavorite }).from(tags).where(eq(tags.id, id)).get()
  if (!current) throw new Error(`Tag ${id} not found`)

  getDb().update(tags).set({ isFavorite: !current.isFavorite, updatedAt: Date.now() }).where(eq(tags.id, id)).run()

  const updated = listTagsForPicker().find((tag) => tag.id === id)
  if (!updated) throw new Error('Tag disappeared immediately after update')
  return updated
}

/**
 * Startup pass over every tag with a URL: fills in a missing clockworkIssueKey (tags created before
 * that column existed) and re-derives existing ones (so a stricter/fixed deriveClockworkIssueKey —
 * e.g. the false-positive-prone version that used to match any "LETTERS-NUMBER" substring anywhere
 * in the URL — corrects tags it previously mis-tagged, not just ones it previously missed).
 */
export function backfillClockworkIssueKeys(): void {
  const rows = getDb()
    .select({ id: tags.id, targetUrl: tags.targetUrl, clockworkIssueKey: tags.clockworkIssueKey })
    .from(tags)
    .where(isNotNull(tags.targetUrl))
    .all()

  for (const row of rows) {
    const derived = deriveClockworkIssueKey(row.targetUrl)
    if (derived !== row.clockworkIssueKey) {
      getDb().update(tags).set({ clockworkIssueKey: derived }).where(eq(tags.id, row.id)).run()
    }
  }
}
