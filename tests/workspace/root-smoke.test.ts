import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("workspace scaffold", () => {
  it("declares every required workspace", () => {
    expect(existsSync("pnpm-workspace.yaml")).toBe(true);

    const workspaceFile = readFileSync("pnpm-workspace.yaml", "utf8");
    const packageEntries = workspaceFile
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- "'))
      .map((line) => line.slice(3, -1));

    expect(packageEntries.sort()).toEqual(
      ["miniprogram", "services/*", "packages/*"].sort(),
    );
  });
});
