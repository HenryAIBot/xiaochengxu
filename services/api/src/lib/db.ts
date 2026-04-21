import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export type QueryTaskDatabase = Database.Database;

export function resolveDefaultQueryTaskDatabasePath() {
  return fileURLToPath(
    new URL("../../data/query-tasks.sqlite", import.meta.url),
  );
}

const DEFAULT_DB_PATH = resolveDefaultQueryTaskDatabasePath();

function ensureColumn(
  db: QueryTaskDatabase,
  tableName: string,
  columnName: string,
  definition: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function initializeSchema(db: QueryTaskDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_tasks (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      input_kind TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      normalized_input TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      level TEXT NOT NULL,
      summary TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '[]',
      recommended_actions_json TEXT NOT NULL DEFAULT '[]',
      extra_json TEXT,
      unlocked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT,
      phone TEXT,
      source_report_id TEXT,
      source_task_id TEXT,
      source_tool TEXT,
      source_input TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      target_kind TEXT NOT NULL,
      target_value TEXT NOT NULL,
      notify_email TEXT,
      notify_phone TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  ensureColumn(db, "reports", "evidence_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(
    db,
    "reports",
    "recommended_actions_json",
    "TEXT NOT NULL DEFAULT '[]'",
  );
  ensureColumn(db, "reports", "extra_json", "TEXT");
  ensureColumn(db, "leads", "source_report_id", "TEXT");
  ensureColumn(db, "leads", "source_task_id", "TEXT");
  ensureColumn(db, "leads", "source_tool", "TEXT");
  ensureColumn(db, "leads", "source_input", "TEXT");
}

export function createQueryTaskDatabase(filePath = DEFAULT_DB_PATH) {
  if (filePath !== ":memory:") {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const db = new Database(filePath);
  initializeSchema(db);
  return db;
}

export function createInMemoryDb() {
  return createQueryTaskDatabase(":memory:");
}
