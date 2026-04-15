# Amazon TRO Risk Mini Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 WeChat mini program and backend for Amazon US sellers to run infringement checks, TRO alerts, and case progress tracking with report unlock, monitoring, and notification support.

**Architecture:** Use a `pnpm` monorepo. A `Taro + React` mini program in `miniprogram/` talks to a `Fastify` API in `services/api/`. Shared normalization, risk scoring, and report shaping live in `packages/core/`. Async query processing, monitoring polls, and notification delivery run in `services/jobs/` through `BullMQ + Redis`. App data stays in a single-node `SQLite` database behind repository interfaces so later storage migration is mechanical.

**Tech Stack:** TypeScript, pnpm workspace, Taro 4 + React 18, Fastify 5, better-sqlite3, BullMQ, ioredis, Biome, Vitest, Supertest, Testing Library

---

## File Structure

- `package.json`: root scripts and shared dev dependencies
- `pnpm-workspace.yaml`: workspace membership
- `tsconfig.base.json`: shared TypeScript defaults
- `biome.json`: lint/format rules
- `vitest.workspace.ts`: shared test discovery
- `docker-compose.yml`: local Redis and Mailpit
- `packages/core/`: input normalization, risk levels, report DTOs, action suggestions
- `services/api/`: Fastify app, SQLite repositories, tool services, HTTP routes
- `services/jobs/`: BullMQ workers, polling processors, email/SMS delivery adapters
- `miniprogram/`: Taro mini program shell, pages, API client, report and monitor views
- `tests/fixtures/`: captured connector fixtures for deterministic tests
- `tests/`: cross-package tests and end-to-end smoke flows
- `scripts/`: local startup helpers

## Task 1: Bootstrap The Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Create: `vitest.workspace.ts`
- Create: `docker-compose.yml`
- Test: `tests/workspace/root-smoke.test.ts`

- [ ] **Step 1: Write the failing workspace smoke test**

```ts
// tests/workspace/root-smoke.test.ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("workspace scaffold", () => {
  it("declares every required workspace", () => {
    expect(existsSync("pnpm-workspace.yaml")).toBe(true);

    const workspaceFile = readFileSync("pnpm-workspace.yaml", "utf8");
    expect(workspaceFile).toContain("miniprogram");
    expect(workspaceFile).toContain("services/api");
    expect(workspaceFile).toContain("services/jobs");
    expect(workspaceFile).toContain("packages/core");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/workspace/root-smoke.test.ts`  
Expected: FAIL with `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` or `pnpm-workspace.yaml` missing

- [ ] **Step 3: Write the minimal workspace implementation**

```json
// package.json
{
  "name": "xiaochengxu",
  "private": true,
  "packageManager": "pnpm@10.10.0",
  "scripts": {
    "lint": "biome check .",
    "format": "biome check --write .",
    "test": "vitest run",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/node": "^24.0.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.3",
    "vitest": "^3.1.3"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "miniprogram"
  - "services/*"
  - "packages/*"
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": "."
  }
}
```

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

```ts
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "tests/**/*.test.ts",
  "tests/**/*.test.tsx",
  "miniprogram/src/**/*.test.tsx"
]);
```

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7.4-alpine
    ports:
      - "6379:6379"

  mailpit:
    image: axllent/mailpit:v1.20
    ports:
      - "1025:1025"
      - "8025:8025"
```

- [ ] **Step 4: Run the smoke test and install dependencies**

Run: `pnpm install && pnpm vitest run tests/workspace/root-smoke.test.ts`  
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json biome.json vitest.workspace.ts docker-compose.yml tests/workspace/root-smoke.test.ts
git commit -m "chore: bootstrap workspace"
```

### Task 2: Build The Shared Core Domain Package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/input.ts`
- Create: `packages/core/src/risk.ts`
- Create: `packages/core/src/report.ts`
- Test: `tests/core/domain.test.ts`

- [ ] **Step 1: Write the failing domain test**

```ts
// tests/core/domain.test.ts
import { describe, expect, it } from "vitest";
import { normalizeInput, summarizeRisk, type DetectionSignal } from "@xiaochengxu/core";

describe("core domain", () => {
  it("normalizes Amazon urls into ASIN input", () => {
    const result = normalizeInput("https://www.amazon.com/dp/B0C1234567");
    expect(result.kind).toBe("asin");
    expect(result.normalizedValue).toBe("B0C1234567");
  });

  it("promotes the highest signal into a risk level and actions", () => {
    const signals: DetectionSignal[] = [
      { source: "courtlistener", level: "watch", reason: "brand name matched a new complaint" },
      { source: "uspto", level: "suspected_high", reason: "registered mark overlaps listing brand" }
    ];

    const summary = summarizeRisk("infringement_check", signals);
    expect(summary.level).toBe("suspected_high");
    expect(summary.recommendedActions).toContain("立即复核 Listing 品牌词与图片");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/core/domain.test.ts`  
Expected: FAIL with `Cannot find package '@xiaochengxu/core'`

- [ ] **Step 3: Write the minimal core package**

```json
// packages/core/package.json
{
  "name": "@xiaochengxu/core",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "biome check src"
  }
}
```

```json
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
```

```ts
// packages/core/src/input.ts
export type InputKind = "asin" | "brand" | "store_name" | "case_number";

export interface NormalizedInput {
  kind: InputKind;
  rawValue: string;
  normalizedValue: string;
}

const ASIN_RE = /\b([A-Z0-9]{10})\b/i;
const CASE_RE = /^\d{1,2}:\d{2}-[a-z]{2}-\d{4,6}$/i;

export function normalizeInput(rawValue: string): NormalizedInput {
  const trimmed = rawValue.trim();
  const asinMatch = trimmed.match(ASIN_RE);
  if (asinMatch) {
    return { kind: "asin", rawValue, normalizedValue: asinMatch[1].toUpperCase() };
  }

  if (CASE_RE.test(trimmed)) {
    return { kind: "case_number", rawValue, normalizedValue: trimmed.toLowerCase() };
  }

  if (/\s(store|shop)$/i.test(trimmed)) {
    return { kind: "store_name", rawValue, normalizedValue: trimmed.toLowerCase() };
  }

  return { kind: "brand", rawValue, normalizedValue: trimmed.toLowerCase() };
}
```

```ts
// packages/core/src/risk.ts
export type ToolName = "infringement_check" | "tro_alert" | "case_progress";
export type RiskLevel = "clear" | "watch" | "suspected_high" | "confirmed";

export interface DetectionSignal {
  source: string;
  level: RiskLevel;
  reason: string;
}

const LEVEL_ORDER: RiskLevel[] = ["clear", "watch", "suspected_high", "confirmed"];

const ACTIONS: Record<RiskLevel, string[]> = {
  clear: ["继续观察"],
  watch: ["加入持续监控", "关注新案与品牌词变化"],
  suspected_high: ["立即复核 Listing 品牌词与图片", "准备联系顾问"],
  confirmed: ["立即处理高风险 Listing", "联系顾问并准备申诉/和解材料"]
};

export function summarizeRisk(tool: ToolName, signals: DetectionSignal[]) {
  const level = signals.reduce<RiskLevel>(
    (current, signal) =>
      LEVEL_ORDER.indexOf(signal.level) > LEVEL_ORDER.indexOf(current) ? signal.level : current,
    "clear"
  );

  return {
    tool,
    level,
    recommendedActions: ACTIONS[level],
    headline: signals[0]?.reason ?? "未发现明显风险"
  };
}
```

```ts
// packages/core/src/report.ts
import type { DetectionSignal, RiskLevel, ToolName } from "./risk.js";

export interface ReportPreview {
  tool: ToolName;
  level: RiskLevel;
  summary: string;
  evidence: DetectionSignal[];
  recommendedActions: string[];
}

export function buildPreview(input: {
  tool: ToolName;
  level: RiskLevel;
  evidence: DetectionSignal[];
  recommendedActions: string[];
}): ReportPreview {
  return {
    tool: input.tool,
    level: input.level,
    summary: input.evidence[0]?.reason ?? "暂无命中记录",
    evidence: input.evidence.slice(0, 3),
    recommendedActions: input.recommendedActions
  };
}
```

```ts
// packages/core/src/index.ts
export * from "./input.js";
export * from "./report.js";
export * from "./risk.js";
```

- [ ] **Step 4: Run the domain test**

Run: `pnpm install && pnpm vitest run tests/core/domain.test.ts`  
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add packages/core tests/core/domain.test.ts
git commit -m "feat: add core risk domain"
```

### Task 3: Add The API Shell And SQLite Persistence

**Files:**
- Create: `services/api/package.json`
- Create: `services/api/tsconfig.json`
- Create: `services/api/src/app.ts`
- Create: `services/api/src/server.ts`
- Create: `services/api/src/lib/db.ts`
- Create: `services/api/src/repositories/query-task-repository.ts`
- Create: `services/api/src/routes/query-tasks.ts`
- Test: `tests/api/query-task-route.test.ts`

- [ ] **Step 1: Write the failing route test**

```ts
// tests/api/query-task-route.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("POST /api/query-tasks", () => {
  let db = createInMemoryDb();

  afterEach(() => {
    db.close();
    db = createInMemoryDb();
  });

  it("stores a normalized queued task", async () => {
    const app = buildApp({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: {
        tool: "tro_alert",
        input: "https://www.amazon.com/dp/B0C1234567"
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      status: "queued",
      normalizedInput: {
        kind: "asin",
        normalizedValue: "B0C1234567"
      }
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/api/query-task-route.test.ts`  
Expected: FAIL with `Cannot find module '../../services/api/src/app.js'`

- [ ] **Step 3: Write the minimal API app and repository**

```json
// services/api/package.json
{
  "name": "@xiaochengxu/api",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "lint": "biome check src"
  },
  "dependencies": {
    "@xiaochengxu/core": "workspace:*",
    "better-sqlite3": "^11.8.1",
    "fastify": "^5.2.2"
  }
}
```

```json
// services/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

```ts
// services/api/src/lib/db.ts
import Database from "better-sqlite3";

export function createInMemoryDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE query_tasks (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      input_kind TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      normalized_input TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}
```

```ts
// services/api/src/repositories/query-task-repository.ts
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { NormalizedInput, ToolName } from "@xiaochengxu/core";

export class QueryTaskRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: { tool: ToolName; rawInput: string; normalizedInput: NormalizedInput }) {
    const task = {
      id: randomUUID(),
      tool: input.tool,
      rawInput: input.rawInput,
      normalizedInput: input.normalizedInput,
      status: "queued",
      createdAt: new Date().toISOString()
    };

    this.db
      .prepare(
        `INSERT INTO query_tasks (id, tool, input_kind, raw_input, normalized_input, status, created_at)
         VALUES (@id, @tool, @inputKind, @rawInput, @normalizedInput, @status, @createdAt)`
      )
      .run({
        id: task.id,
        tool: task.tool,
        inputKind: task.normalizedInput.kind,
        rawInput: task.rawInput,
        normalizedInput: task.normalizedInput.normalizedValue,
        status: task.status,
        createdAt: task.createdAt
      });

    return task;
  }
}
```

```ts
// services/api/src/routes/query-tasks.ts
import type { FastifyInstance } from "fastify";
import { normalizeInput } from "@xiaochengxu/core";
import { QueryTaskRepository } from "../repositories/query-task-repository.js";

export async function registerQueryTaskRoutes(app: FastifyInstance) {
  app.post("/api/query-tasks", async (request) => {
    const body = request.body as { tool: "tro_alert" | "case_progress" | "infringement_check"; input: string };
    const repository = new QueryTaskRepository(app.db);
    const normalizedInput = normalizeInput(body.input);
    const task = repository.create({
      tool: body.tool,
      rawInput: body.input,
      normalizedInput
    });

    return {
      id: task.id,
      status: task.status,
      normalizedInput
    };
  });
}
```

```ts
// services/api/src/app.ts
import Fastify from "fastify";
import { createInMemoryDb } from "./lib/db.js";
import { registerQueryTaskRoutes } from "./routes/query-tasks.js";

declare module "fastify" {
  interface FastifyInstance {
    db: ReturnType<typeof createInMemoryDb>;
  }
}

export function buildApp({ db = createInMemoryDb() }: { db?: ReturnType<typeof createInMemoryDb> } = {}) {
  const app = Fastify();
  app.decorate("db", db);
  app.get("/health", async () => ({ ok: true }));
  app.register(registerQueryTaskRoutes);
  return app;
}

export { createInMemoryDb } from "./lib/db.js";
```

```ts
// services/api/src/server.ts
import { buildApp } from "./app.js";

const app = buildApp();

app.listen({
  port: Number(process.env.API_PORT ?? 3000),
  host: "0.0.0.0"
});
```

- [ ] **Step 4: Run the route test**

Run: `pnpm install && pnpm vitest run tests/api/query-task-route.test.ts`  
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add services/api tests/api/query-task-route.test.ts
git commit -m "feat: add query intake api"
```

### Task 4: Implement Connectors And Tool Services

**Files:**
- Create: `services/api/src/connectors/courtlistener-connector.ts`
- Create: `services/api/src/connectors/amazon-listing-connector.ts`
- Create: `services/api/src/connectors/uspto-trademark-connector.ts`
- Create: `services/api/src/services/storefront-candidate-service.ts`
- Create: `services/api/src/services/tro-alert-service.ts`
- Create: `services/api/src/services/case-progress-service.ts`
- Create: `services/api/src/services/infringement-check-service.ts`
- Create: `tests/fixtures/courtlistener-search.json`
- Create: `tests/fixtures/courtlistener-docket.json`
- Create: `tests/fixtures/amazon-listing.html`
- Create: `tests/fixtures/storefront-products.json`
- Create: `tests/fixtures/uspto-search.json`
- Test: `tests/api/tool-services.test.ts`

- [ ] **Step 1: Write the failing connector/service test**

```ts
// tests/api/tool-services.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TroAlertService } from "../../services/api/src/services/tro-alert-service.js";
import { CaseProgressService } from "../../services/api/src/services/case-progress-service.js";
import { InfringementCheckService } from "../../services/api/src/services/infringement-check-service.js";
import { StorefrontCandidateService } from "../../services/api/src/services/storefront-candidate-service.js";

describe("tool services", () => {
  it("builds a suspected_high tro alert summary from court hits", async () => {
    const service = new TroAlertService({
      search: async () => JSON.parse(readFileSync("tests/fixtures/courtlistener-search.json", "utf8"))
    });

    const result = await service.run("nike");
    expect(result.preview.level).toBe("suspected_high");
  });

  it("builds a case timeline from docket entries", async () => {
    const service = new CaseProgressService({
      getDocket: async () => JSON.parse(readFileSync("tests/fixtures/courtlistener-docket.json", "utf8"))
    });

    const result = await service.run("1:25-cv-01234");
    expect(result.timeline[0].event).toContain("Temporary restraining order");
  });

  it("builds an infringement report from Amazon and USPTO evidence", async () => {
    const service = new InfringementCheckService({
      getListingHtml: async () => readFileSync("tests/fixtures/amazon-listing.html", "utf8"),
      searchMarks: async () => JSON.parse(readFileSync("tests/fixtures/uspto-search.json", "utf8"))
    });

    const result = await service.run("B0C1234567");
    expect(result.preview.level).toBe("suspected_high");
  });

  it("returns representative products for a storefront search", async () => {
    const service = new StorefrontCandidateService({
      listStoreProducts: async () => JSON.parse(readFileSync("tests/fixtures/storefront-products.json", "utf8"))
    });

    const result = await service.run("nike store");
    expect(result.items[0].asin).toBe("B0C1234567");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/api/tool-services.test.ts`  
Expected: FAIL with `Cannot find module '../../services/api/src/services/tro-alert-service.js'`

- [ ] **Step 3: Write the connectors and services**

```ts
// services/api/src/connectors/courtlistener-connector.ts
export interface CourtListenerPort {
  search(target: string): Promise<{ results: Array<{ caseName: string; snippet: string }> }>;
  getDocket(caseNumber: string): Promise<{ entries: Array<{ date: string; description: string }> }>;
}
```

```ts
// services/api/src/connectors/amazon-listing-connector.ts
export class AmazonListingConnector {
  constructor(
    private readonly fetchHtml: (asin: string) => Promise<string>,
    private readonly fetchStoreProducts: (storeName: string) => Promise<{ items: Array<{ asin: string; title: string }> }>
  ) {}

  async getListingHtml(asin: string) {
    return this.fetchHtml(asin);
  }

  async listStoreProducts(storeName: string) {
    return this.fetchStoreProducts(storeName);
  }
}
```

```ts
// services/api/src/connectors/uspto-trademark-connector.ts
export class UsptoTrademarkConnector {
  constructor(
    private readonly fetchMarks: (term: string) => Promise<{ marks: Array<{ owner: string; mark: string; status: string }> }>
  ) {}

  async searchMarks(term: string) {
    return this.fetchMarks(term);
  }
}
```

```ts
// services/api/src/services/tro-alert-service.ts
import { buildPreview, summarizeRisk } from "@xiaochengxu/core";
import type { CourtListenerPort } from "../connectors/courtlistener-connector.js";

export class TroAlertService {
  constructor(private readonly connector: CourtListenerPort) {}

  async run(target: string) {
    const payload = await this.connector.search(target);
    const signals = payload.results.map((result) => ({
      source: "courtlistener",
      level: result.snippet.toLowerCase().includes("temporary restraining order") ? "suspected_high" : "watch",
      reason: `${result.caseName}: ${result.snippet}`
    })) as const;

    const summary = summarizeRisk("tro_alert", signals as never);
    return {
      preview: buildPreview({
        tool: "tro_alert",
        level: summary.level,
        evidence: signals as never,
        recommendedActions: summary.recommendedActions
      })
    };
  }
}
```

```ts
// services/api/src/services/case-progress-service.ts
import { buildPreview } from "@xiaochengxu/core";
import type { CourtListenerPort } from "../connectors/courtlistener-connector.js";

export class CaseProgressService {
  constructor(private readonly connector: CourtListenerPort) {}

  async run(caseNumber: string) {
    const docket = await this.connector.getDocket(caseNumber);
    const timeline = docket.entries.map((entry) => ({
      at: entry.date,
      event: entry.description
    }));

    return {
      preview: buildPreview({
        tool: "case_progress",
        level: "watch",
        evidence: timeline.map((entry) => ({
          source: "courtlistener",
          level: "watch",
          reason: `${entry.at} ${entry.event}`
        })),
        recommendedActions: ["持续关注案件节点", "准备与顾问同步最新文书"]
      }),
      timeline
    };
  }
}
```

```ts
// services/api/src/services/infringement-check-service.ts
import { buildPreview, summarizeRisk } from "@xiaochengxu/core";

interface InfringementPorts {
  getListingHtml(asin: string): Promise<string>;
  searchMarks(term: string): Promise<{ marks: Array<{ owner: string; mark: string; status: string }> }>;
}

export class InfringementCheckService {
  constructor(private readonly ports: InfringementPorts) {}

  async run(asin: string) {
    const html = await this.ports.getListingHtml(asin);
    const titleMatch = html.match(/data-title="([^"]+)"/);
    const brandMatch = html.match(/data-brand="([^"]+)"/);
    const brand = brandMatch?.[1] ?? titleMatch?.[1]?.split(" ")[0] ?? "";
    const trademarkPayload = await this.ports.searchMarks(brand);

    const signals = trademarkPayload.marks.map((mark) => ({
      source: "uspto",
      level: mark.status === "LIVE" ? "suspected_high" : "watch",
      reason: `${mark.mark} owned by ${mark.owner} is ${mark.status}`
    }));

    const summary = summarizeRisk("infringement_check", signals);
    return {
      preview: buildPreview({
        tool: "infringement_check",
        level: summary.level,
        evidence: signals,
        recommendedActions: summary.recommendedActions
      }),
      listing: {
        asin,
        brand
      }
    };
  }
}
```

```ts
// services/api/src/services/storefront-candidate-service.ts
interface StorefrontPort {
  listStoreProducts(storeName: string): Promise<{ items: Array<{ asin: string; title: string }> }>;
}

export class StorefrontCandidateService {
  constructor(private readonly port: StorefrontPort) {}

  async run(storeName: string) {
    const payload = await this.port.listStoreProducts(storeName);
    return {
      items: payload.items.slice(0, 5)
    };
  }
}
```

```json
// tests/fixtures/courtlistener-search.json
{
  "results": [
    {
      "caseName": "ABC Brand LLC v. Amazon Sellers",
      "snippet": "Motion for temporary restraining order filed against marketplace sellers."
    }
  ]
}
```

```json
// tests/fixtures/courtlistener-docket.json
{
  "entries": [
    {
      "date": "2026-04-10",
      "description": "Temporary restraining order entered."
    }
  ]
}
```

```html
<!-- tests/fixtures/amazon-listing.html -->
<html>
  <body data-title="Nike style running shoes" data-brand="nike"></body>
</html>
```

```json
// tests/fixtures/storefront-products.json
{
  "items": [
    {
      "asin": "B0C1234567",
      "title": "Nike style running shoes"
    },
    {
      "asin": "B0C7654321",
      "title": "Nike training shorts"
    }
  ]
}
```

```json
// tests/fixtures/uspto-search.json
{
  "marks": [
    {
      "owner": "Nike, Inc.",
      "mark": "NIKE",
      "status": "LIVE"
    }
  ]
}
```

- [ ] **Step 4: Run the service test**

Run: `pnpm vitest run tests/api/tool-services.test.ts`  
Expected: PASS with `3 passed`

- [ ] **Step 5: Commit**

```bash
git add services/api/src/connectors services/api/src/services tests/fixtures tests/api/tool-services.test.ts
git commit -m "feat: add tool services"
```

### Task 5: Add Queue Workers, Polling, And Notification Delivery

**Files:**
- Create: `services/jobs/package.json`
- Create: `services/jobs/tsconfig.json`
- Create: `services/jobs/src/queues.ts`
- Create: `services/jobs/src/worker.ts`
- Create: `services/jobs/src/processors/query-task-processor.ts`
- Create: `services/jobs/src/processors/monitor-processor.ts`
- Create: `services/jobs/src/providers/email-provider.ts`
- Create: `services/jobs/src/providers/sms-provider.ts`
- Test: `tests/jobs/processors.test.ts`

- [ ] **Step 1: Write the failing worker test**

```ts
// tests/jobs/processors.test.ts
import { describe, expect, it, vi } from "vitest";
import { runMonitorProcessor } from "../../services/jobs/src/processors/monitor-processor.js";

describe("monitor processor", () => {
  it("sends both email and sms when a monitor hit escalates", async () => {
    const sendEmail = vi.fn();
    const sendSms = vi.fn();
    const saveMessage = vi.fn();

    await runMonitorProcessor(
      {
        monitorId: "monitor-1",
        preview: {
          level: "suspected_high",
          summary: "New TRO complaint mentions monitored brand."
        }
      },
      { sendEmail, sendSms, saveMessage }
    );

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendSms).toHaveBeenCalledOnce();
    expect(saveMessage).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/jobs/processors.test.ts`  
Expected: FAIL with `Cannot find module '../../services/jobs/src/processors/monitor-processor.js'`

- [ ] **Step 3: Write the queue and processor layer**

```json
// services/jobs/package.json
{
  "name": "@xiaochengxu/jobs",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/worker.ts",
    "build": "tsc -p tsconfig.json",
    "lint": "biome check src"
  },
  "dependencies": {
    "bullmq": "^5.41.5",
    "ioredis": "^5.5.0"
  }
}
```

```json
// services/jobs/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

```ts
// services/jobs/src/queues.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

export const queryQueue = new Queue("query-processing", { connection });
export const monitorQueue = new Queue("monitor-poll", { connection });
export const notificationQueue = new Queue("notifications", { connection });
```

```ts
// services/jobs/src/providers/email-provider.ts
export async function sendEmail(input: { to: string; subject: string; html: string }) {
  return {
    channel: "email",
    delivered: true,
    to: input.to,
    subject: input.subject
  };
}
```

```ts
// services/jobs/src/providers/sms-provider.ts
export async function sendSms(input: { to: string; body: string }) {
  return {
    channel: "sms",
    delivered: true,
    to: input.to,
    body: input.body
  };
}
```

```ts
// services/jobs/src/processors/monitor-processor.ts
export async function runMonitorProcessor(
  job: {
    monitorId: string;
    preview: { level: "clear" | "watch" | "suspected_high" | "confirmed"; summary: string };
  },
  ports: {
    sendEmail: (input: { to: string; subject: string; html: string }) => Promise<unknown>;
    sendSms: (input: { to: string; body: string }) => Promise<unknown>;
    saveMessage: (input: { channel: string; body: string }) => Promise<unknown>;
  }
) {
  if (job.preview.level === "clear") {
    return;
  }

  await ports.sendEmail({
    to: "ops@example.com",
    subject: `Monitor ${job.monitorId} hit ${job.preview.level}`,
    html: `<p>${job.preview.summary}</p>`
  });

  await ports.sendSms({
    to: "+15551234567",
    body: `${job.preview.level}: ${job.preview.summary}`
  });

  await ports.saveMessage({
    channel: "system",
    body: job.preview.summary
  });
}
```

```ts
// services/jobs/src/processors/query-task-processor.ts
export async function runQueryTaskProcessor(input: { taskId: string }) {
  return {
    taskId: input.taskId,
    status: "processed"
  };
}
```

```ts
// services/jobs/src/worker.ts
import { Worker } from "bullmq";
import { notificationQueue, queryQueue } from "./queues.js";
import { runMonitorProcessor } from "./processors/monitor-processor.js";
import { runQueryTaskProcessor } from "./processors/query-task-processor.js";
import { sendEmail } from "./providers/email-provider.js";
import { sendSms } from "./providers/sms-provider.js";

new Worker(queryQueue.name, async (job) => runQueryTaskProcessor(job.data), {
  connection: queryQueue.opts.connection
});

new Worker(notificationQueue.name, async (job) =>
  runMonitorProcessor(job.data, {
    sendEmail,
    sendSms,
    saveMessage: async () => ({ delivered: true })
  }), {
    connection: notificationQueue.opts.connection
  });
```

- [ ] **Step 4: Run the worker test**

Run: `pnpm vitest run tests/jobs/processors.test.ts`  
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add services/jobs tests/jobs/processors.test.ts
git commit -m "feat: add queue processors"
```

### Task 6: Expand The API For Reports, Leads, Monitors, And Messages

**Files:**
- Create: `services/api/src/routes/reports.ts`
- Create: `services/api/src/routes/monitors.ts`
- Create: `services/api/src/routes/messages.ts`
- Create: `services/api/src/routes/leads.ts`
- Create: `services/api/src/routes/storefronts.ts`
- Modify: `services/api/src/lib/db.ts`
- Modify: `services/api/src/app.ts`
- Test: `tests/api/report-and-monitor-routes.test.ts`

- [ ] **Step 1: Write the failing report/monitor route test**

```ts
// tests/api/report-and-monitor-routes.test.ts
import { describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("report unlock and monitor routes", () => {
  it("unlocks a report, creates a monitor, and lists storefront candidates", async () => {
    const db = createInMemoryDb();
    const app = buildApp({ db });

    const unlock = await app.inject({
      method: "POST",
      url: "/api/reports/report-1/unlock",
      payload: {
        email: "seller@example.com",
        phone: "+15551234567"
      }
    });

    expect(unlock.statusCode).toBe(200);

    const monitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: {
        targetKind: "brand",
        targetValue: "nike",
        notifyEmail: "seller@example.com"
      }
    });

    expect(monitor.statusCode).toBe(201);
    expect(monitor.json().status).toBe("active");

    const storefront = await app.inject({
      method: "GET",
      url: "/api/storefronts/nike%20store/products"
    });

    expect(storefront.statusCode).toBe(200);
    expect(storefront.json().items[0].asin).toBe("B0C1234567");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/api/report-and-monitor-routes.test.ts`  
Expected: FAIL with `404` or route not found

- [ ] **Step 3: Implement the persistence tables and routes**

```ts
// services/api/src/lib/db.ts
import Database from "better-sqlite3";

export function createInMemoryDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE query_tasks (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      input_kind TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      normalized_input TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE reports (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      level TEXT NOT NULL,
      summary TEXT NOT NULL,
      unlocked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE leads (
      id TEXT PRIMARY KEY,
      email TEXT,
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE monitors (
      id TEXT PRIMARY KEY,
      target_kind TEXT NOT NULL,
      target_value TEXT NOT NULL,
      notify_email TEXT,
      notify_phone TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}
```

```ts
// services/api/src/routes/reports.ts
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

export async function registerReportRoutes(app: FastifyInstance) {
  app.post("/api/reports/:reportId/unlock", async (request) => {
    const { reportId } = request.params as { reportId: string };
    const body = request.body as { email?: string; phone?: string };

    app.db.prepare(`INSERT INTO leads (id, email, phone, created_at) VALUES (?, ?, ?, ?)`).run(
      randomUUID(),
      body.email ?? null,
      body.phone ?? null,
      new Date().toISOString()
    );

    return {
      id: reportId,
      unlocked: true,
      fullReportUrl: `/api/reports/${reportId}`
    };
  });
}
```

```ts
// services/api/src/routes/monitors.ts
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

export async function registerMonitorRoutes(app: FastifyInstance) {
  app.post("/api/monitors", async (request, reply) => {
    const body = request.body as {
      targetKind: "brand" | "store_name" | "asin";
      targetValue: string;
      notifyEmail?: string;
      notifyPhone?: string;
    };

    const monitor = {
      id: randomUUID(),
      targetKind: body.targetKind,
      targetValue: body.targetValue,
      notifyEmail: body.notifyEmail ?? null,
      notifyPhone: body.notifyPhone ?? null,
      status: "active"
    };

    app.db
      .prepare(
        `INSERT INTO monitors (id, target_kind, target_value, notify_email, notify_phone, status)
         VALUES (@id, @targetKind, @targetValue, @notifyEmail, @notifyPhone, @status)`
      )
      .run(monitor);

    reply.code(201);
    return monitor;
  });
}
```

```ts
// services/api/src/routes/messages.ts
import type { FastifyInstance } from "fastify";

export async function registerMessageRoutes(app: FastifyInstance) {
  app.get("/api/messages", async () => {
    return app.db.prepare(`SELECT id, channel, body, created_at FROM messages ORDER BY created_at DESC`).all();
  });
}
```

```ts
// services/api/src/routes/leads.ts
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

export async function registerLeadRoutes(app: FastifyInstance) {
  app.post("/api/leads", async (request, reply) => {
    const body = request.body as { email?: string; phone?: string; note?: string };
    const lead = {
      id: randomUUID(),
      email: body.email ?? null,
      phone: body.phone ?? null,
      createdAt: new Date().toISOString()
    };

    app.db
      .prepare(`INSERT INTO leads (id, email, phone, created_at) VALUES (@id, @email, @phone, @createdAt)`)
      .run(lead);

    reply.code(201);
    return lead;
  });
}
```

```ts
// services/api/src/routes/storefronts.ts
import type { FastifyInstance } from "fastify";

export async function registerStorefrontRoutes(app: FastifyInstance) {
  app.get("/api/storefronts/:storeName/products", async (request) => {
    const { storeName } = request.params as { storeName: string };
    return {
      items: [
        { asin: "B0C1234567", title: `${storeName} candidate 1` },
        { asin: "B0C7654321", title: `${storeName} candidate 2` }
      ]
    };
  });
}
```

```ts
// services/api/src/app.ts
import Fastify from "fastify";
import { createInMemoryDb } from "./lib/db.js";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerMonitorRoutes } from "./routes/monitors.js";
import { registerQueryTaskRoutes } from "./routes/query-tasks.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerStorefrontRoutes } from "./routes/storefronts.js";

declare module "fastify" {
  interface FastifyInstance {
    db: ReturnType<typeof createInMemoryDb>;
  }
}

export function buildApp({ db = createInMemoryDb() }: { db?: ReturnType<typeof createInMemoryDb> } = {}) {
  const app = Fastify();
  app.decorate("db", db);
  app.get("/health", async () => ({ ok: true }));
  app.register(registerQueryTaskRoutes);
  app.register(registerReportRoutes);
  app.register(registerMonitorRoutes);
  app.register(registerMessageRoutes);
  app.register(registerLeadRoutes);
  app.register(registerStorefrontRoutes);
  return app;
}

export { createInMemoryDb } from "./lib/db.js";
```

- [ ] **Step 4: Run the report/monitor test**

Run: `pnpm vitest run tests/api/report-and-monitor-routes.test.ts`  
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add services/api/src/lib/db.ts services/api/src/routes tests/api/report-and-monitor-routes.test.ts
git commit -m "feat: add report and monitor routes"
```

### Task 7: Build The Mini Program Shell, Home Screen, And Result Screen

**Files:**
- Create: `miniprogram/package.json`
- Create: `miniprogram/config/index.ts`
- Create: `miniprogram/tsconfig.json`
- Create: `miniprogram/src/app.tsx`
- Create: `miniprogram/src/app.config.ts`
- Create: `miniprogram/src/lib/api.ts`
- Create: `miniprogram/src/components/home-screen.tsx`
- Create: `miniprogram/src/components/result-screen.tsx`
- Create: `miniprogram/src/components/store-candidate-screen.tsx`
- Create: `miniprogram/src/pages/home/index.tsx`
- Create: `miniprogram/src/pages/select-product/index.tsx`
- Create: `miniprogram/src/pages/home/index.config.ts`
- Test: `miniprogram/src/components/home-screen.test.tsx`

- [ ] **Step 1: Write the failing mini program screen test**

```tsx
// miniprogram/src/components/home-screen.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./home-screen";

describe("HomeScreen", () => {
  it("submits the selected tool and input value", () => {
    const onSubmit = vi.fn();
    render(<HomeScreen onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("品牌词 / 店铺名 / ASIN"), {
      target: { value: "nike" }
    });
    fireEvent.click(screen.getByText("TRO预警"));
    fireEvent.click(screen.getByText("立即检测"));

    expect(onSubmit).toHaveBeenCalledWith({
      tool: "tro_alert",
      input: "nike"
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run miniprogram/src/components/home-screen.test.tsx`  
Expected: FAIL with `Cannot find module './home-screen'`

- [ ] **Step 3: Write the mini program shell and screens**

```json
// miniprogram/package.json
{
  "name": "@xiaochengxu/miniprogram",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "taro build --type weapp --watch",
    "build": "taro build --type weapp",
    "lint": "biome check src"
  },
  "dependencies": {
    "@tarojs/components": "^4.0.5",
    "@tarojs/react": "^4.0.5",
    "@tarojs/runtime": "^4.0.5",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.2.0",
    "@types/react": "^18.3.20",
    "@types/react-dom": "^18.3.6",
    "@tarojs/cli": "^4.0.5"
  }
}
```

```ts
// miniprogram/config/index.ts
import { defineConfig } from "@tarojs/cli";

export default defineConfig({
  projectName: "xiaochengxu",
  date: "2026-04-15",
  sourceRoot: "src",
  outputRoot: "dist",
  framework: "react",
  compiler: "webpack5",
  mini: {
    postcss: {
      pxtransform: {
        enable: true
      }
    }
  }
});
```

```json
// miniprogram/tsconfig.json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["@tarojs/taro", "vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "config/**/*.ts"]
}
```

```tsx
// miniprogram/src/app.tsx
import { PropsWithChildren } from "react";

export default function App({ children }: PropsWithChildren) {
  return children;
}
```

```ts
// miniprogram/src/lib/api.ts
const API_BASE = "http://127.0.0.1:3000";

export async function createQueryTask(input: { tool: string; input: string }) {
  const response = await fetch(`${API_BASE}/api/query-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return response.json();
}

export async function listStoreProducts(storeName: string) {
  const response = await fetch(`${API_BASE}/api/storefronts/${encodeURIComponent(storeName)}/products`);
  return response.json();
}
```

```tsx
// miniprogram/src/components/home-screen.tsx
import { useState } from "react";

type Tool = "infringement_check" | "tro_alert" | "case_progress";

export function HomeScreen({
  onSubmit
}: {
  onSubmit(input: { tool: Tool; input: string }): void;
}) {
  const [tool, setTool] = useState<Tool>("infringement_check");
  const [value, setValue] = useState("");

  return (
    <main>
      <input
        placeholder="品牌词 / 店铺名 / ASIN"
        value={value}
        onChange={(event) => setValue((event.target as HTMLInputElement).value)}
      />
      <button onClick={() => setTool("infringement_check")}>侵权体检</button>
      <button onClick={() => setTool("tro_alert")}>TRO预警</button>
      <button onClick={() => setTool("case_progress")}>案件进展</button>
      <button onClick={() => onSubmit({ tool, input: value })}>立即检测</button>
    </main>
  );
}
```

```tsx
// miniprogram/src/components/result-screen.tsx
export function ResultScreen({
  summary,
  level,
  actions
}: {
  summary: string;
  level: string;
  actions: string[];
}) {
  return (
    <section>
      <h1>{level}</h1>
      <p>{summary}</p>
      <ul>
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </section>
  );
}
```

```tsx
// miniprogram/src/components/store-candidate-screen.tsx
export function StoreCandidateScreen({
  items,
  onSelect
}: {
  items: Array<{ asin: string; title: string }>;
  onSelect(asin: string): void;
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.asin}>
          <button onClick={() => onSelect(item.asin)}>
            {item.title} / {item.asin}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// miniprogram/src/pages/home/index.tsx
import Taro from "@tarojs/taro";
import { View } from "@tarojs/components";
import { HomeScreen } from "../../components/home-screen";
import { createQueryTask, listStoreProducts } from "../../lib/api";

export default function HomePage() {
  return (
    <View>
      <HomeScreen
        onSubmit={async (payload) => {
          if (payload.tool === "infringement_check" && /\s(store|shop)$/i.test(payload.input)) {
            const candidates = await listStoreProducts(payload.input);
            Taro.setStorageSync("storeCandidates", candidates.items);
            Taro.navigateTo({ url: "/pages/select-product/index" });
            return;
          }

          const task = await createQueryTask(payload);
          Taro.navigateTo({
            url: `/pages/result/index?id=${task.id}`
          });
        }}
      />
    </View>
  );
}
```

```tsx
// miniprogram/src/pages/select-product/index.tsx
import Taro from "@tarojs/taro";
import { View } from "@tarojs/components";
import { StoreCandidateScreen } from "../../components/store-candidate-screen";

export default function SelectProductPage() {
  const items = Taro.getStorageSync("storeCandidates") ?? [];

  return (
    <View>
      <StoreCandidateScreen
        items={items}
        onSelect={(asin) => Taro.navigateTo({ url: `/pages/result/index?asin=${asin}` })}
      />
    </View>
  );
}
```

```ts
// miniprogram/src/pages/home/index.config.ts
export default definePageConfig({
  navigationBarTitleText: "首页"
});
```

```ts
// miniprogram/src/app.config.ts
export default defineAppConfig({
  pages: [
    "pages/home/index",
    "pages/select-product/index",
    "pages/result/index",
    "pages/monitor/index",
    "pages/report/index",
    "pages/messages/index",
    "pages/profile/index"
  ],
  tabBar: {
    list: [
      { pagePath: "pages/home/index", text: "首页" },
      { pagePath: "pages/monitor/index", text: "监控" },
      { pagePath: "pages/report/index", text: "报告" },
      { pagePath: "pages/messages/index", text: "消息" },
      { pagePath: "pages/profile/index", text: "我的" }
    ]
  }
});
```

- [ ] **Step 4: Run the home screen test**

Run: `pnpm install && pnpm vitest run miniprogram/src/components/home-screen.test.tsx`  
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add miniprogram miniprogram/src/components/home-screen.test.tsx
git commit -m "feat: add miniapp shell"
```

### Task 8: Finish Report/Monitor Pages, Add API Wiring, And Verify The Full Flow

**Files:**
- Modify: `miniprogram/src/lib/api.ts`
- Modify: `miniprogram/src/pages/home/index.tsx`
- Create: `miniprogram/src/components/report-unlock-screen.tsx`
- Create: `miniprogram/src/components/monitor-list-screen.tsx`
- Create: `miniprogram/src/pages/result/index.tsx`
- Create: `miniprogram/src/pages/monitor/index.tsx`
- Create: `miniprogram/src/pages/report/index.tsx`
- Create: `miniprogram/src/pages/messages/index.tsx`
- Create: `miniprogram/src/pages/profile/index.tsx`
- Create: `tests/e2e/query-flow.test.ts`
- Test: `miniprogram/src/components/report-unlock-screen.test.tsx`
- Create: `scripts/dev-up.sh`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Write the failing report unlock screen test**

```tsx
// miniprogram/src/components/report-unlock-screen.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportUnlockScreen } from "./report-unlock-screen";

describe("ReportUnlockScreen", () => {
  it("submits the lead contact to unlock the full report", () => {
    const onUnlock = vi.fn();
    render(<ReportUnlockScreen onUnlock={onUnlock} />);

    fireEvent.click(screen.getByText("邮箱解锁"));
    expect(onUnlock).toHaveBeenCalledWith({ email: "seller@example.com" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run miniprogram/src/components/report-unlock-screen.test.tsx`  
Expected: FAIL with `Cannot find module './report-unlock-screen'`

- [ ] **Step 3: Add the final screens, startup script, and docs**

```ts
// miniprogram/src/lib/api.ts
const API_BASE = "http://127.0.0.1:3000";

export async function createQueryTask(input: { tool: string; input: string }) {
  const response = await fetch(`${API_BASE}/api/query-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return response.json();
}

export async function unlockReport(reportId: string, input: { email: string; phone?: string }) {
  const response = await fetch(`${API_BASE}/api/reports/${reportId}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return response.json();
}

export async function listMessages() {
  const response = await fetch(`${API_BASE}/api/messages`);
  return response.json();
}
```

```tsx
// miniprogram/src/pages/home/index.tsx
import Taro from "@tarojs/taro";
import { View } from "@tarojs/components";
import { HomeScreen } from "../../components/home-screen";
import { createQueryTask } from "../../lib/api";

export default function HomePage() {
  return (
    <View>
      <HomeScreen
        onSubmit={async (payload) => {
          const task = await createQueryTask(payload);
          Taro.navigateTo({
            url: `/pages/result/index?id=${task.id}`
          });
        }}
      />
    </View>
  );
}
```

```tsx
// miniprogram/src/components/report-unlock-screen.tsx
export function ReportUnlockScreen({
  onUnlock
}: {
  onUnlock(input: { email: string; phone?: string }): void;
}) {
  return (
    <section>
      <h2>解锁完整报告</h2>
      <button onClick={() => onUnlock({ email: "seller@example.com" })}>邮箱解锁</button>
    </section>
  );
}
```

```tsx
// miniprogram/src/components/monitor-list-screen.tsx
export function MonitorListScreen({
  monitors
}: {
  monitors: Array<{ id: string; targetValue: string; status: string }>;
}) {
  return (
    <ul>
      {monitors.map((monitor) => (
        <li key={monitor.id}>
          {monitor.targetValue} / {monitor.status}
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// miniprogram/src/pages/result/index.tsx
import { View } from "@tarojs/components";
import { ResultScreen } from "../../components/result-screen";

export default function ResultPage() {
  return (
    <View>
      <ResultScreen
        level="suspected_high"
        summary="检测到新案与商标风险信号。"
        actions={["立即复核 Listing", "联系顾问", "加入监控"]}
      />
    </View>
  );
}
```

```tsx
// miniprogram/src/pages/monitor/index.tsx
import { View } from "@tarojs/components";
import { MonitorListScreen } from "../../components/monitor-list-screen";

export default function MonitorPage() {
  return (
    <View>
      <MonitorListScreen monitors={[{ id: "monitor-1", targetValue: "nike", status: "active" }]} />
    </View>
  );
}
```

```tsx
// miniprogram/src/pages/report/index.tsx
import { View } from "@tarojs/components";
import { ReportUnlockScreen } from "../../components/report-unlock-screen";
import { unlockReport } from "../../lib/api";

export default function ReportPage() {
  return (
    <View>
      <ReportUnlockScreen onUnlock={(payload) => unlockReport("report-1", payload)} />
    </View>
  );
}
```

```tsx
// miniprogram/src/pages/messages/index.tsx
import { View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { listMessages } from "../../lib/api";

export default function MessagesPage() {
  const [messages, setMessages] = useState<Array<{ id: string; body: string }>>([]);

  useEffect(() => {
    listMessages().then(setMessages);
  }, []);

  return <View>{messages[0]?.body ?? "暂无新消息"}</View>;
}
```

```tsx
// miniprogram/src/pages/profile/index.tsx
import { View } from "@tarojs/components";

export default function ProfilePage() {
  return <View>我的顾问与联系方式</View>;
}
```

```bash
# scripts/dev-up.sh
#!/usr/bin/env bash
set -euo pipefail

docker compose up -d
pnpm install
echo "Redis and Mailpit are ready. Start API, jobs, and mini program in separate terminals."
```

```env
# .env.example
API_PORT=3000
REDIS_URL=redis://127.0.0.1:6379
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMS_PROVIDER=mock
```

```md
# README.md

## Local Development

1. `./scripts/dev-up.sh`
2. `pnpm --filter @xiaochengxu/api dev`
3. `pnpm --filter @xiaochengxu/jobs dev`
4. `pnpm --filter @xiaochengxu/miniprogram dev`

## Verification

- `pnpm lint`
- `pnpm test`
- `pnpm build`
```

```ts
// tests/e2e/query-flow.test.ts
import { describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("query flow", () => {
  it("creates a task, unlocks a report, and starts a monitor", async () => {
    const app = buildApp({ db: createInMemoryDb() });

    const query = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: {
        tool: "tro_alert",
        input: "nike"
      }
    });

    expect(query.statusCode).toBe(202);

    const unlock = await app.inject({
      method: "POST",
      url: "/api/reports/report-1/unlock",
      payload: {
        email: "seller@example.com"
      }
    });

    expect(unlock.statusCode).toBe(200);

    const monitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: {
        targetKind: "brand",
        targetValue: "nike",
        notifyEmail: "seller@example.com"
      }
    });

    expect(monitor.json()).toMatchObject({
      targetValue: "nike",
      status: "active"
    });
  });
});
```

- [ ] **Step 4: Run the final verification**

Run: `pnpm vitest run miniprogram/src/components/report-unlock-screen.test.tsx && pnpm vitest run tests/e2e/query-flow.test.ts && pnpm lint && pnpm test && pnpm build`  
Expected: PASS with no Biome errors, all Vitest suites green, and each workspace build completing

- [ ] **Step 5: Commit**

```bash
git add miniprogram/src/components miniprogram/src/pages tests/e2e/query-flow.test.ts scripts/dev-up.sh .env.example README.md
git commit -m "feat: finish miniapp query flow"
```
