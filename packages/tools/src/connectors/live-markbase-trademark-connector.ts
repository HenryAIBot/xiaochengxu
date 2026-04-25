import type { TrademarkSearchMark } from "./uspto-trademark-connector.js";

type FetchLike = typeof fetch;

export interface LiveMarkbaseTrademarkOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  maxResults?: number;
  statusCodes?: string[];
}

interface MarkbaseHit {
  serial_number?: string | null;
  word_mark?: string | null;
  owner_name?: string | null;
  registration_number?: string | null;
  status_code?: string | null;
}

interface MarkbaseSearchResponse {
  hits?: MarkbaseHit[];
}

function markbaseStatusToRiskStatus(
  statusCode?: string | null,
): "LIVE" | "DEAD" {
  const numeric = Number(statusCode);
  if (numeric >= 700 && numeric < 900) return "LIVE";
  return "DEAD";
}

function tsdrUrl(serialNumber?: string | null): string | undefined {
  if (!serialNumber) return undefined;
  return `https://tsdr.uspto.gov/#caseNumber=${serialNumber}&caseType=SERIAL_NO&searchType=statusSearch`;
}

export class LiveMarkbaseTrademarkConnector {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxResults: number;
  private readonly statusCodes: string[];

  constructor(options: LiveMarkbaseTrademarkOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.markbase.co").replace(
      /\/+$/,
      "",
    );
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxResults = options.maxResults ?? 10;
    this.statusCodes = options.statusCodes ?? ["700", "800"];
  }

  async searchMarks(term: string): Promise<{ marks: TrademarkSearchMark[] }> {
    const hits = await this.searchHits(term);
    const seen = new Set<string>();
    const marks: TrademarkSearchMark[] = [];

    for (const hit of hits) {
      const owner = hit.owner_name?.trim();
      const mark = hit.word_mark?.trim().toUpperCase();
      if (!owner || !mark) continue;

      const key = `${hit.serial_number ?? ""}\u0000${owner}\u0000${mark}`;
      if (seen.has(key)) continue;
      seen.add(key);

      marks.push({
        owner,
        mark,
        status: markbaseStatusToRiskStatus(hit.status_code),
        url: tsdrUrl(hit.serial_number),
      });

      if (marks.length >= this.maxResults) break;
    }

    return { marks };
  }

  private async searchHits(term: string): Promise<MarkbaseHit[]> {
    const statusCodes = this.statusCodes.length > 0 ? this.statusCodes : [""];
    const batches = await Promise.all(
      statusCodes.map((statusCode) => this.requestSearch(term, statusCode)),
    );
    return batches.flat();
  }

  private async requestSearch(
    term: string,
    statusCode: string,
  ): Promise<MarkbaseHit[]> {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set("q", term);
    url.searchParams.set("limit", String(this.maxResults));
    if (statusCode) url.searchParams.set("status_code", statusCode);

    const response = await this.fetchImpl(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Markbase trademark search failed: ${response.status} ${response.statusText} ${detail}`,
      );
    }

    const payload = (await response.json()) as MarkbaseSearchResponse;
    return payload.hits ?? [];
  }
}
