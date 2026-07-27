import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Mirrors migrations/0001_init.sql exactly — that SQL file is the actual source of truth
 * for the database's DDL (we run it ourselves at startup rather than using drizzle-kit push/
 * generate), this just gives Drizzle's query builder the matching, typed shape to query against.
 */

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  targetUrl: text('target_url'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const timers = sqliteTable('timers', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  kind: text('kind', { enum: ['one_off', 'persistent', 'custom_log'] }).notNull(),
  status: text('status', { enum: ['running', 'paused', 'stopped', 'submitted', 'discarded'] }).notNull(),
  tagId: text('tag_id').references(() => tags.id),
  startedAt: integer('started_at').notNull(),
  currentSegmentStartedAt: integer('current_segment_started_at'),
  accumulatedMs: integer('accumulated_ms').notNull(),
  stoppedAt: integer('stopped_at'),
  submittedAt: integer('submitted_at'),
  discardedAt: integer('discarded_at'),
  note: text('note'),
  pausedReason: text('paused_reason', { enum: ['manual', 'switched', 'idle'] }),
  switchedToTitle: text('switched_to_title'),
  linkOpenedAt: integer('link_opened_at'),
  loggedConfirmedAt: integer('logged_confirmed_at'),
  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

/** Permanent per-day tracked-time totals — written once when a timer is finalized (stopped or
 *  custom-logged) and never touched again, so archiving/clearing history can't erase past stats. */
export const dailyStats = sqliteTable('daily_stats', {
  date: text('date').primaryKey(),
  totalMs: integer('total_ms').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const links = sqliteTable('links', {
  id: text('id').primaryKey(),
  timerId: text('timer_id')
    .notNull()
    .references(() => timers.id, { onDelete: 'cascade' }),
  linkType: text('link_type', { enum: ['browser_url', 'explorer_path', 'application'] }).notNull(),
  value: text('value').notNull(),
  title: text('title'),
  icon: text('icon'),
  createdAt: integer('created_at').notNull()
})
