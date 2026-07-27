import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import migration0001 from './migrations/0001_init.sql?raw'
import migration0002 from './migrations/0002_allow_idle_paused_reason.sql?raw'
import migration0003 from './migrations/0003_custom_log_kind_and_tracking.sql?raw'
import migration0004 from './migrations/0004_archive_and_daily_stats.sql?raw'
import migration0005 from './migrations/0005_clockwork_issue_key.sql?raw'

const MIGRATIONS: { version: number; sql: string }[] = [
  { version: 1, sql: migration0001 },
  { version: 2, sql: migration0002 },
  { version: 3, sql: migration0003 },
  { version: 4, sql: migration0004 },
  { version: 5, sql: migration0005 }
]

export type DrizzleDb = ReturnType<typeof drizzle>

let sqlite: Database.Database | null = null
let db: DrizzleDb | null = null

function ensureInitialized(): void {
  if (sqlite) return

  const dbPath = path.join(app.getPath('userData'), 'timetracker.db')
  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  runMigrations(sqlite)

  db = drizzle(sqlite)
}

/** Drizzle query builder — used by the repositories for all normal reads/writes. */
export function getDb(): DrizzleDb {
  ensureInitialized()
  return db as DrizzleDb
}

/**
 * The underlying better-sqlite3 connection, for its `.transaction()` wrapper only — Drizzle's
 * own `db.transaction()` API expects queries to run through a `tx` handle it hands you, which
 * doesn't fit how the repositories call `getDb()` internally. BEGIN/COMMIT/ROLLBACK on the raw
 * connection still correctly wraps whatever Drizzle queries run against it in the meantime,
 * since they share the same underlying connection.
 */
export function getRawSqlite(): Database.Database {
  ensureInitialized()
  return sqlite as Database.Database
}

function runMigrations(database: Database.Database): void {
  const currentVersion = database.pragma('user_version', { simple: true }) as number

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue

    const applyMigration = database.transaction(() => {
      database.exec(migration.sql)
      database.pragma(`user_version = ${migration.version}`)
    })
    applyMigration()
  }
}
