import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../services/api/src/app.js";
import type { SqliteAdapter } from "../../services/api/src/lib/db-adapter.js";
import { resolveDefaultQueryTaskDatabasePath } from "../../services/api/src/lib/db.js";

describe("query task database path", () => {
  const originalCwd = process.cwd();
  const defaultDbPath = fileURLToPath(
    new URL("../../services/api/data/query-tasks.sqlite", import.meta.url),
  );

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(defaultDbPath, { force: true });
  });

  it("resolves relative to the api package instead of the shell cwd", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "query-task-db-"));
    process.chdir(tempDir);

    expect(resolveDefaultQueryTaskDatabasePath()).toBe(defaultDbPath);
  });

  it("uses the file-backed sqlite database by default", async () => {
    const app = buildApp();

    try {
      const underlying = (app.db as SqliteAdapter).getUnderlying();
      expect(underlying.name).toBe(defaultDbPath);
    } finally {
      await app.close();
    }
  });

  it("closes the owned file-backed database when the app closes", async () => {
    const app = buildApp();
    const underlying = (app.db as SqliteAdapter).getUnderlying();

    await app.close();

    expect(() => underlying.prepare("SELECT 1")).toThrow();
  });
});
