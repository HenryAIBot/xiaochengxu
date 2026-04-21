import type {
  CourtListenerDocketEntry,
  CourtListenerPort,
  CourtListenerSearchResult,
} from "./courtlistener-connector.js";

type FetchLike = typeof fetch;

export interface LiveCourtListenerOptions {
  token: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  maxResults?: number;
}

// Mapping targets the CourtListener REST v4 shape documented at
// https://www.courtlistener.com/help/api/rest/. Results can use either snake_case
// or camelCase depending on the endpoint; we accept both.
interface SearchResultRaw {
  caseName?: string;
  case_name?: string;
  snippet?: string;
  docketNumber?: string;
  docket_number?: string;
}

interface DocketEntryRaw {
  date_filed?: string;
  dateFiled?: string;
  description?: string;
  entry_number?: number;
  recap_documents?: Array<{ description?: string }>;
}

interface Paginated<T> {
  count?: number;
  results?: T[];
}

function pickString(...values: Array<string | undefined>): string {
  return values.find((v) => typeof v === "string" && v.length > 0) ?? "";
}

export class LiveCourtListenerConnector implements CourtListenerPort {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxResults: number;

  constructor(options: LiveCourtListenerOptions) {
    if (!options.token) {
      throw new Error("LiveCourtListenerConnector requires a token");
    }
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? "https://www.courtlistener.com").replace(
      /\/+$/,
      "",
    );
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxResults = options.maxResults ?? 5;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Token ${this.token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `CourtListener ${path} failed: ${response.status} ${response.statusText} ${detail}`,
      );
    }
    return (await response.json()) as T;
  }

  async search(target: string) {
    const q = encodeURIComponent(target);
    const payload = await this.request<Paginated<SearchResultRaw>>(
      `/api/rest/v4/search/?q=${q}&type=r&order_by=dateFiled+desc`,
    );

    const results: CourtListenerSearchResult[] = (payload.results ?? [])
      .slice(0, this.maxResults)
      .map((raw) => ({
        caseName: pickString(raw.caseName, raw.case_name),
        snippet: pickString(raw.snippet),
      }))
      .filter((r) => r.caseName.length > 0);

    return { results };
  }

  async getDocket(caseNumber: string) {
    const q = encodeURIComponent(caseNumber);
    const payload = await this.request<Paginated<DocketEntryRaw>>(
      `/api/rest/v4/docket-entries/?docket__docket_number=${q}&order_by=-date_filed`,
    );

    const entries: CourtListenerDocketEntry[] = (payload.results ?? [])
      .slice(0, this.maxResults)
      .map((raw) => ({
        date: pickString(raw.date_filed, raw.dateFiled),
        description: pickString(
          raw.description,
          raw.recap_documents?.[0]?.description,
        ),
      }))
      .filter((e) => e.date.length > 0 && e.description.length > 0);

    return { entries };
  }
}
