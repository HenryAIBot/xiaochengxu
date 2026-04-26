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
  absolute_url?: string;
  absoluteUrl?: string;
}

interface RecapDocumentRaw {
  description?: string;
  absolute_url?: string;
  absoluteUrl?: string;
  filepath_ia?: string;
  filepathIa?: string;
  page_count?: number;
  pageCount?: number;
  is_available?: boolean;
  isAvailable?: boolean;
}

interface DocketEntryRaw {
  date_filed?: string;
  dateFiled?: string;
  description?: string;
  entry_number?: number;
  recap_documents?: RecapDocumentRaw[];
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
      .map((raw) => {
        const relative = pickString(raw.absolute_url, raw.absoluteUrl);
        return {
          caseName: pickString(raw.caseName, raw.case_name),
          snippet: pickString(raw.snippet),
          url: relative ? `${this.baseUrl}${relative}` : undefined,
        };
      })
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
      .map((raw) => {
        const documents = this.mapRecapDocuments(raw.recap_documents);
        return {
          date: pickString(raw.date_filed, raw.dateFiled),
          description: pickString(
            raw.description,
            raw.recap_documents?.[0]?.description,
          ),
          ...(documents.length > 0 ? { documents } : {}),
        };
      })
      .filter((e) => e.date.length > 0 && e.description.length > 0);

    return { entries };
  }

  private mapRecapDocuments(
    raw: RecapDocumentRaw[] | undefined,
  ): NonNullable<CourtListenerDocketEntry["documents"]> {
    if (!raw || raw.length === 0) return [];
    return raw
      .map((doc) => {
        const relative = pickString(doc.absolute_url, doc.absoluteUrl);
        const ia = pickString(doc.filepath_ia, doc.filepathIa);
        const url = relative ? `${this.baseUrl}${relative}` : ia;
        if (!url) return undefined;
        const description = pickString(doc.description);
        const pageCount = doc.page_count ?? doc.pageCount;
        const isAvailable = doc.is_available ?? doc.isAvailable;
        return {
          url,
          ...(description ? { description } : {}),
          ...(typeof pageCount === "number" ? { pageCount } : {}),
          ...(typeof isAvailable === "boolean" ? { isAvailable } : {}),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== undefined);
  }
}
