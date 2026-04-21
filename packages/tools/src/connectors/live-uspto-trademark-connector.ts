import type { TrademarkSearchMark } from "./uspto-trademark-connector.js";

type FetchLike = typeof fetch;

export interface LiveUsptoOptions {
  /**
   * A URL template that will be queried with the search term substituted in.
   * Supports two placeholders:
   *   {term} — the brand/mark search string
   *   {termEncoded} — URL-encoded version (recommended for query strings)
   *
   * Example: "https://api.my-uspto-proxy.example/marks?q={termEncoded}"
   */
  urlTemplate: string;
  /**
   * Optional Authorization header value forwarded to the backing service.
   */
  authHeader?: string;
  fetchImpl?: FetchLike;
  maxResults?: number;
}

interface MarkRaw {
  owner?: string;
  mark?: string;
  wordmark?: string;
  status?: string;
  registrationStatus?: string;
}

interface Paginated<T> {
  results?: T[];
  marks?: T[];
  data?: T[];
}

function pickMarks(payload: Paginated<MarkRaw> | MarkRaw[]): MarkRaw[] {
  if (Array.isArray(payload)) return payload;
  return payload.results ?? payload.marks ?? payload.data ?? [];
}

export class LiveUsptoTrademarkConnector {
  private readonly urlTemplate: string;
  private readonly authHeader?: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxResults: number;

  constructor(options: LiveUsptoOptions) {
    if (!options.urlTemplate) {
      throw new Error("LiveUsptoTrademarkConnector requires urlTemplate");
    }
    this.urlTemplate = options.urlTemplate;
    this.authHeader = options.authHeader;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxResults = options.maxResults ?? 10;
  }

  async searchMarks(term: string): Promise<{ marks: TrademarkSearchMark[] }> {
    const url = this.urlTemplate
      .replace("{term}", term)
      .replace("{termEncoded}", encodeURIComponent(term));

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.authHeader) headers.Authorization = this.authHeader;

    const response = await this.fetchImpl(url, { headers });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `USPTO proxy ${url} failed: ${response.status} ${response.statusText} ${detail}`,
      );
    }

    const payload = (await response.json()) as Paginated<MarkRaw> | MarkRaw[];
    const raws = pickMarks(payload).slice(0, this.maxResults);

    const marks: TrademarkSearchMark[] = raws
      .map((raw) => ({
        owner: raw.owner ?? "",
        mark: (raw.mark ?? raw.wordmark ?? "").toUpperCase(),
        status: (raw.status ?? raw.registrationStatus ?? "LIVE").toUpperCase(),
      }))
      .filter((m) => m.owner && m.mark);

    return { marks };
  }
}
