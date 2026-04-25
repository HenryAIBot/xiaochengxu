import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

export interface LoadRootEnvOptions {
  startDir?: string;
  filename?: string;
  override?: boolean;
}

export interface LoadRootEnvResult {
  loaded: boolean;
  path: string | null;
  keys: string[];
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;

  const [, key, rawValue] = match;
  return [key, unquote(rawValue ?? "")];
}

function findUp(startDir: string, filename: string): string | null {
  let current = resolve(startDir);
  while (true) {
    const candidate = join(current, filename);
    if (existsSync(candidate)) return candidate;

    const parent = dirname(current);
    if (parent === current || parse(current).root === current) return null;
    current = parent;
  }
}

export function loadRootEnv(
  options: LoadRootEnvOptions = {},
): LoadRootEnvResult {
  const filename = options.filename ?? ".env";
  const path = findUp(options.startDir ?? process.cwd(), filename);
  if (!path) {
    return { loaded: false, path: null, keys: [] };
  }

  const keys: string[] = [];
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/g)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;

    const [key, value] = parsed;
    if (!options.override && process.env[key] !== undefined) continue;

    process.env[key] = value;
    keys.push(key);
  }

  return { loaded: true, path, keys };
}
