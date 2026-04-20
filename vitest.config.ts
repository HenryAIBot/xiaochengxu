import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@xiaochengxu/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
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
