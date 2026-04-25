import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRootEnv } from "@xiaochengxu/tools";
import { afterEach, describe, expect, it } from "vitest";

describe("loadRootEnv", () => {
  const touched = new Set<string>();

  afterEach(() => {
    for (const key of touched) {
      delete process.env[key];
    }
    touched.clear();
  });

  it("finds .env upward from a nested directory and loads missing keys", () => {
    const root = mkdtempSync(join(tmpdir(), "xiaochengxu-env-"));
    const nested = join(root, "services", "api");
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(root, ".env"),
      'RAINFOREST_API_KEY=local-key\nQUOTED_VALUE="hello world"\n',
    );
    touched.add("RAINFOREST_API_KEY");
    touched.add("QUOTED_VALUE");

    const result = loadRootEnv({ startDir: nested });

    expect(result.loaded).toBe(true);
    expect(result.keys).toEqual(["RAINFOREST_API_KEY", "QUOTED_VALUE"]);
    expect(process.env.RAINFOREST_API_KEY).toBe("local-key");
    expect(process.env.QUOTED_VALUE).toBe("hello world");
    rmSync(root, { recursive: true, force: true });
  });

  it("does not override explicit process env unless requested", () => {
    const root = mkdtempSync(join(tmpdir(), "xiaochengxu-env-"));
    writeFileSync(join(root, ".env"), "API_PORT=9999\n");
    process.env.API_PORT = "3000";
    touched.add("API_PORT");

    loadRootEnv({ startDir: root });
    expect(process.env.API_PORT).toBe("3000");

    loadRootEnv({ startDir: root, override: true });
    expect(process.env.API_PORT).toBe("9999");
    rmSync(root, { recursive: true, force: true });
  });
});
