import type { NormalizedInput, ToolName } from "@xiaochengxu/core";
import { TtlCache } from "./cache.js";
import type { CourtListenerPort } from "./connectors/courtlistener-connector.js";
import { FixtureAmazonListingConnector } from "./connectors/fixture-amazon-listing-connector.js";
import { FixtureCourtListenerConnector } from "./connectors/fixture-courtlistener-connector.js";
import { FixtureUsptoTrademarkConnector } from "./connectors/fixture-uspto-trademark-connector.js";
import { LiveAmazonListingConnector } from "./connectors/live-amazon-listing-connector.js";
import { LiveCourtListenerConnector } from "./connectors/live-courtlistener-connector.js";
import { LiveMarkbaseTrademarkConnector } from "./connectors/live-markbase-trademark-connector.js";
import { LiveRainforestAmazonConnector } from "./connectors/live-rainforest-amazon-connector.js";
import { LiveUsptoTrademarkConnector } from "./connectors/live-uspto-trademark-connector.js";
import {
  createTokenBucketLimiter,
  readLimiterConfig,
  wrapConnectorWithLimiter,
} from "./rate-limit.js";
import { CaseProgressService } from "./services/case-progress-service.js";
import { InfringementCheckService } from "./services/infringement-check-service.js";
import { TroAlertService } from "./services/tro-alert-service.js";

export * from "./cache.js";
export * from "./env-loader.js";
export * from "./rate-limit.js";
export * from "./connectors/amazon-listing-connector.js";
export * from "./connectors/courtlistener-connector.js";
export * from "./connectors/uspto-trademark-connector.js";
export * from "./connectors/fixture-amazon-listing-connector.js";
export * from "./connectors/fixture-courtlistener-connector.js";
export * from "./connectors/fixture-uspto-trademark-connector.js";
export * from "./connectors/live-courtlistener-connector.js";
export * from "./connectors/live-markbase-trademark-connector.js";
export * from "./connectors/live-rainforest-amazon-connector.js";
export * from "./connectors/live-uspto-trademark-connector.js";
export * from "./connectors/mock-amazon-listing-connector.js";
export * from "./connectors/mock-courtlistener-connector.js";
export * from "./connectors/mock-uspto-trademark-connector.js";
export * from "./services/case-progress-service.js";
export * from "./services/infringement-check-service.js";
export * from "./services/storefront-candidate-service.js";
export * from "./services/tro-alert-service.js";

export type DataSource = "fixture" | "live" | "mixed";
export const DATA_SOURCE_FIXTURE: DataSource = "fixture";
export const DATA_SOURCE_LIVE: DataSource = "live";

export interface ToolResult {
  level: string;
  summary: string;
  evidence: unknown[];
  recommendedActions: string[];
  extra?: unknown;
  dataSource: DataSource;
  sourceFetchedAt: string;
}

export interface RunQueryToolInput {
  tool: ToolName;
  normalizedInput: NormalizedInput;
}

export type MonitorTargetKind = "brand" | "store_name" | "asin" | "case_number";

export interface MonitorCheckInput {
  targetKind: MonitorTargetKind;
  targetValue: string;
}

export interface MonitorCheckResult {
  level: string;
  summary: string;
  tool: ToolName;
  dataSource: DataSource;
}

export function pickMonitorTool(targetKind: MonitorTargetKind): {
  tool: ToolName;
  inputKind: NormalizedInput["kind"];
} {
  switch (targetKind) {
    case "asin":
      return { tool: "infringement_check", inputKind: "asin" };
    case "brand":
      return { tool: "infringement_check", inputKind: "brand" };
    case "case_number":
      return { tool: "case_progress", inputKind: "case_number" };
    case "store_name":
      return { tool: "tro_alert", inputKind: "store_name" };
    default:
      return { tool: "tro_alert", inputKind: "brand" };
  }
}

export function mergeDataSources(...sources: DataSource[]): DataSource {
  if (sources.length === 0) return DATA_SOURCE_FIXTURE;
  const unique = new Set(sources);
  if (unique.size === 1) return sources[0];
  return "mixed";
}

let fixtureWarningEmitted = false;
function warnFixtureOnce() {
  if (fixtureWarningEmitted) return;
  fixtureWarningEmitted = true;
  console.warn(
    "[@xiaochengxu/tools] One or more connectors are fixture — results are deterministic sample data, NOT live API calls. Set COURTLISTENER_API_TOKEN, USPTO_SEARCH_PROVIDER=markbase or USPTO_SEARCH_URL_TEMPLATE, and RAINFOREST_API_KEY to enable live data.",
  );
}

export interface UsptoPort {
  searchMarks(term: string): Promise<{
    marks: Array<{ owner: string; mark: string; status: string }>;
  }>;
}

export interface AmazonPort {
  getListingHtml(asin: string): Promise<string>;
  listStoreProducts?(
    storeName: string,
  ): Promise<{ items: Array<{ asin: string; title: string }> }>;
}

export interface ToolExecutorOverrides {
  courtListener?: { connector: CourtListenerPort; source: DataSource };
  uspto?: { connector: UsptoPort; source: DataSource };
  amazon?: { connector: AmazonPort; source: DataSource };
}

export interface DataSourceCapabilityStatus {
  provider: "courtlistener" | "uspto" | "amazon";
  capability:
    | "court_search"
    | "docket_entries"
    | "trademark_search"
    | "listing_lookup"
    | "storefront_lookup";
  dataSource: DataSource;
  configured: boolean;
  requiredEnv: string[];
  optionalEnv: string[];
  missingEnv: string[];
}

function configuredStatus(input: {
  provider: DataSourceCapabilityStatus["provider"];
  capability: DataSourceCapabilityStatus["capability"];
  requiredEnv: string[];
  optionalEnv: string[];
  env?: NodeJS.ProcessEnv;
}): DataSourceCapabilityStatus {
  const env = input.env ?? process.env;
  const missingEnv = input.requiredEnv.filter((key) => !env[key]);
  const configured = missingEnv.length === 0;
  return {
    provider: input.provider,
    capability: input.capability,
    dataSource: configured ? DATA_SOURCE_LIVE : DATA_SOURCE_FIXTURE,
    configured,
    requiredEnv: input.requiredEnv,
    optionalEnv: input.optionalEnv,
    missingEnv,
  };
}

export function describeDefaultDataSources(
  env: NodeJS.ProcessEnv = process.env,
): { items: DataSourceCapabilityStatus[] } {
  const usptoStatus = (() => {
    if (env.USPTO_SEARCH_URL_TEMPLATE) {
      return configuredStatus({
        provider: "uspto",
        capability: "trademark_search",
        requiredEnv: ["USPTO_SEARCH_URL_TEMPLATE"],
        optionalEnv: ["USPTO_AUTH_HEADER"],
        env,
      });
    }
    if (env.USPTO_SEARCH_PROVIDER === "markbase") {
      return {
        provider: "uspto" as const,
        capability: "trademark_search" as const,
        dataSource: DATA_SOURCE_LIVE,
        configured: true,
        requiredEnv: ["USPTO_SEARCH_PROVIDER"],
        optionalEnv: ["MARKBASE_API_BASE_URL", "MARKBASE_STATUS_CODES"],
        missingEnv: [],
      };
    }
    return {
      provider: "uspto" as const,
      capability: "trademark_search" as const,
      dataSource: DATA_SOURCE_FIXTURE,
      configured: false,
      requiredEnv: [
        "USPTO_SEARCH_URL_TEMPLATE or USPTO_SEARCH_PROVIDER=markbase",
      ],
      optionalEnv: ["USPTO_AUTH_HEADER", "MARKBASE_API_BASE_URL"],
      missingEnv: [
        "USPTO_SEARCH_URL_TEMPLATE or USPTO_SEARCH_PROVIDER=markbase",
      ],
    };
  })();

  return {
    items: [
      configuredStatus({
        provider: "courtlistener",
        capability: "court_search",
        requiredEnv: ["COURTLISTENER_API_TOKEN"],
        optionalEnv: ["COURTLISTENER_BASE_URL"],
        env,
      }),
      configuredStatus({
        provider: "courtlistener",
        capability: "docket_entries",
        requiredEnv: ["COURTLISTENER_API_TOKEN"],
        optionalEnv: ["COURTLISTENER_BASE_URL"],
        env,
      }),
      usptoStatus,
      configuredStatus({
        provider: "amazon",
        capability: "listing_lookup",
        requiredEnv:
          env.RAINFOREST_API_KEY && !env.AMAZON_LISTING_URL_TEMPLATE
            ? ["RAINFOREST_API_KEY"]
            : ["AMAZON_LISTING_URL_TEMPLATE"],
        optionalEnv: ["AMAZON_AUTH_HEADER"],
        env,
      }),
      configuredStatus({
        provider: "amazon",
        capability: "storefront_lookup",
        requiredEnv: [
          ...(env.RAINFOREST_API_KEY && !env.AMAZON_LISTING_URL_TEMPLATE
            ? ["RAINFOREST_API_KEY"]
            : ["AMAZON_LISTING_URL_TEMPLATE", "AMAZON_STORE_URL_TEMPLATE"]),
        ],
        optionalEnv: ["AMAZON_AUTH_HEADER"],
        env,
      }),
    ],
  };
}

function applyProviderLimiter<T extends object>(
  provider: string,
  source: DataSource,
  connector: T,
  defaults: { capacity: number; refillIntervalMs: number },
): T {
  // Only rate-limit live connectors — fixtures are in-process.
  if (source !== DATA_SOURCE_LIVE) return connector;
  const opts = readLimiterConfig(provider, defaults);
  const limiter = createTokenBucketLimiter(opts);
  return wrapConnectorWithLimiter(
    connector as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >,
    limiter,
  ) as unknown as T;
}

export function resolveAmazonConnector(override?: {
  connector: AmazonPort;
  source: DataSource;
}): { connector: AmazonPort; source: DataSource } {
  if (override) return override;
  const listingUrlTemplate = process.env.AMAZON_LISTING_URL_TEMPLATE;
  if (listingUrlTemplate) {
    const connector = new LiveAmazonListingConnector({
      listingUrlTemplate,
      storeUrlTemplate: process.env.AMAZON_STORE_URL_TEMPLATE,
      authHeader: process.env.AMAZON_AUTH_HEADER,
    });
    return {
      connector: applyProviderLimiter("amazon", DATA_SOURCE_LIVE, connector, {
        capacity: 5,
        refillIntervalMs: 2000,
      }),
      source: DATA_SOURCE_LIVE,
    };
  }
  const rainforestApiKey = process.env.RAINFOREST_API_KEY;
  if (rainforestApiKey) {
    const connector = new LiveRainforestAmazonConnector({
      apiKey: rainforestApiKey,
      baseUrl: process.env.RAINFOREST_API_BASE_URL,
      amazonDomain: process.env.RAINFOREST_AMAZON_DOMAIN,
    });
    return {
      connector: applyProviderLimiter("amazon", DATA_SOURCE_LIVE, connector, {
        capacity: 5,
        refillIntervalMs: 2000,
      }),
      source: DATA_SOURCE_LIVE,
    };
  }
  return {
    connector: new FixtureAmazonListingConnector(),
    source: DATA_SOURCE_FIXTURE,
  };
}

export function resolveUsptoConnector(override?: {
  connector: UsptoPort;
  source: DataSource;
}): { connector: UsptoPort; source: DataSource } {
  if (override) return override;
  const urlTemplate = process.env.USPTO_SEARCH_URL_TEMPLATE;
  if (urlTemplate) {
    const connector = new LiveUsptoTrademarkConnector({
      urlTemplate,
      authHeader: process.env.USPTO_AUTH_HEADER,
    });
    return {
      connector: applyProviderLimiter("uspto", DATA_SOURCE_LIVE, connector, {
        capacity: 10,
        refillIntervalMs: 1000,
      }),
      source: DATA_SOURCE_LIVE,
    };
  }
  if (process.env.USPTO_SEARCH_PROVIDER === "markbase") {
    const statusCodes = process.env.MARKBASE_STATUS_CODES
      ? process.env.MARKBASE_STATUS_CODES.split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;
    const connector = new LiveMarkbaseTrademarkConnector({
      baseUrl: process.env.MARKBASE_API_BASE_URL,
      statusCodes,
    });
    return {
      connector: applyProviderLimiter("uspto", DATA_SOURCE_LIVE, connector, {
        capacity: 10,
        refillIntervalMs: 1000,
      }),
      source: DATA_SOURCE_LIVE,
    };
  }
  return {
    connector: new FixtureUsptoTrademarkConnector(),
    source: DATA_SOURCE_FIXTURE,
  };
}

export function resolveCourtListenerConnector(override?: {
  connector: CourtListenerPort;
  source: DataSource;
}): { connector: CourtListenerPort; source: DataSource } {
  if (override) {
    return override;
  }
  const token = process.env.COURTLISTENER_API_TOKEN;
  if (token) {
    const connector = new LiveCourtListenerConnector({
      token,
      baseUrl: process.env.COURTLISTENER_BASE_URL,
    });
    return {
      connector: applyProviderLimiter(
        "courtlistener",
        DATA_SOURCE_LIVE,
        connector,
        { capacity: 10, refillIntervalMs: 1000 },
      ),
      source: DATA_SOURCE_LIVE,
    };
  }
  return {
    connector: new FixtureCourtListenerConnector(),
    source: DATA_SOURCE_FIXTURE,
  };
}

export function createDefaultMonitorChecker(overrides?: ToolExecutorOverrides) {
  const runQueryTool = createDefaultToolExecutor(overrides);
  return async function runMonitorCheck(
    input: MonitorCheckInput,
  ): Promise<MonitorCheckResult> {
    const { tool, inputKind } = pickMonitorTool(input.targetKind);
    const result = await runQueryTool({
      tool,
      normalizedInput: {
        kind: inputKind,
        rawValue: input.targetValue,
        normalizedValue: input.targetValue,
      },
    });
    return {
      level: result.level,
      summary: result.summary,
      tool,
      dataSource: result.dataSource,
    };
  };
}

export interface ToolExecutorConfig extends ToolExecutorOverrides {
  cacheTtlMs?: number;
}

export function createDefaultToolExecutor(config?: ToolExecutorConfig) {
  const courtListenerResolved = resolveCourtListenerConnector(
    config?.courtListener,
  );
  const courtListener = courtListenerResolved.connector;
  const courtListenerSource = courtListenerResolved.source;
  const usptoResolved = resolveUsptoConnector(config?.uspto);
  const uspto = usptoResolved.connector;
  const usptoSource = usptoResolved.source;
  const amazonResolved = resolveAmazonConnector(config?.amazon);
  const amazon = amazonResolved.connector;
  const amazonSource = amazonResolved.source;

  const troAlert = new TroAlertService(courtListener);
  const infringement = new InfringementCheckService({
    getListingHtml: (asin) => amazon.getListingHtml(asin),
    searchMarks: (term) => uspto.searchMarks(term),
  });
  const caseProgress = new CaseProgressService(courtListener);

  const cacheTtlMs =
    config?.cacheTtlMs ?? Number(process.env.TOOL_CACHE_TTL_MS ?? 5 * 60_000);
  const cache = new TtlCache<ToolResult>({ ttlMs: cacheTtlMs });

  function cacheKey(input: RunQueryToolInput): string {
    return `${input.tool}:${input.normalizedInput.kind}:${input.normalizedInput.normalizedValue}`;
  }

  return async function runQueryTool(
    input: RunQueryToolInput,
  ): Promise<ToolResult> {
    const cached = cache.get(cacheKey(input));
    if (cached) {
      return { ...cached.value, sourceFetchedAt: cached.fetchedAt };
    }

    const { tool, normalizedInput } = input;
    let result: ToolResult;
    switch (tool) {
      case "tro_alert": {
        if (courtListenerSource === DATA_SOURCE_FIXTURE) warnFixtureOnce();
        const r = await troAlert.run(normalizedInput.normalizedValue);
        result = {
          level: r.preview.level,
          summary: r.preview.summary,
          evidence: r.preview.evidence,
          recommendedActions: r.preview.recommendedActions,
          dataSource: courtListenerSource,
          sourceFetchedAt: "",
        };
        break;
      }
      case "infringement_check": {
        const dataSource =
          normalizedInput.kind === "asin"
            ? mergeDataSources(amazonSource, usptoSource)
            : usptoSource;
        if (dataSource !== DATA_SOURCE_LIVE) warnFixtureOnce();
        const r = await infringement.run(
          normalizedInput.normalizedValue,
          normalizedInput.kind,
        );
        result = {
          level: r.preview.level,
          summary: r.preview.summary,
          evidence: r.preview.evidence,
          recommendedActions: r.preview.recommendedActions,
          extra: r.listing,
          dataSource,
          sourceFetchedAt: "",
        };
        break;
      }
      case "case_progress": {
        if (courtListenerSource === DATA_SOURCE_FIXTURE) warnFixtureOnce();
        const r = await caseProgress.run(normalizedInput.normalizedValue);
        result = {
          level: r.preview.level,
          summary: r.preview.summary,
          evidence: r.preview.evidence,
          recommendedActions: r.preview.recommendedActions,
          extra: { timeline: r.timeline },
          dataSource: courtListenerSource,
          sourceFetchedAt: "",
        };
        break;
      }
      default:
        result = {
          level: "clear",
          summary: "未知检测类型",
          evidence: [],
          recommendedActions: [],
          dataSource: DATA_SOURCE_FIXTURE,
          sourceFetchedAt: "",
        };
    }

    const entry = cache.set(cacheKey(input), result);
    return { ...result, sourceFetchedAt: entry.fetchedAt };
  };
}
