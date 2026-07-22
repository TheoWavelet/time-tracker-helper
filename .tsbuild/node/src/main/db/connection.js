import path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import migration0001 from './migrations/0001_init.sql?raw';
const MIGRATIONS = [{ version: 1, sql: migration0001 }];
let db = null;
export function getDb() {
    if (db)
        return db;
    const dbPath = path.join(app.getPath('userData'), 'timetracker.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    return db;
}
function runMigrations(database) {
    const currentVersion = database.pragma('user_version', { simple: true });
    for (const migration of MIGRATIONS) {
        if (migration.version <= currentVersion)
            continue;
        const applyMigration = database.transaction(() => {
            database.exec(migration.sql);
            database.pragma(`user_version = ${migration.version}`);
        });
        applyMigration();
    }
}
