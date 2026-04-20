import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(scriptPath));

const sourceRoot = join(
  repoRoot,
  "node_modules",
  ".pnpm",
  "node_modules",
  "@tarojs",
);
const targetRoot = join(repoRoot, "node_modules", "@tarojs");

const packages = [
  "plugin-platform-weapp",
  "plugin-framework-react",
  "webpack5-runner",
  "taro",
  "shared",
];

mkdirSync(targetRoot, { recursive: true });

for (const name of packages) {
  const source = join(sourceRoot, name);
  const target = join(targetRoot, name);
  rmSync(target, { force: true, recursive: true });
  symlinkSync(source, target, "dir");
}
