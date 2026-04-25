import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@xiaochengxu/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@xiaochengxu/tools": fileURLToPath(
        new URL("./packages/tools/src/index.ts", import.meta.url),
      ),
      "@xiaochengxu/queue": fileURLToPath(
        new URL("./packages/queue/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "packages/*/src/**/*.ts",
        "services/*/src/**/*.ts",
        "miniprogram/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.d.ts",
        "**/test/**",
        "**/*.test.{ts,tsx}",
        "miniprogram/config/**",
        "services/*/src/server.ts",
        "services/*/src/scripts/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "root",
          environment: "node",
          include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "miniprogram",
          environment: "jsdom",
          include: [
            "miniprogram/src/**/*.test.ts",
            "miniprogram/src/**/*.test.tsx",
          ],
          setupFiles: ["./miniprogram/src/test/setup.ts"],
        },
      },
    ],
  },
});
