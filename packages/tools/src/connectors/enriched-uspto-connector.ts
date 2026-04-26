import type { LiveUsptoTsdrConnector } from "./live-uspto-tsdr-connector.js";
import type { TrademarkSearchMark } from "./uspto-trademark-connector.js";

export interface UsptoBasePort {
  searchMarks(term: string): Promise<{ marks: TrademarkSearchMark[] }>;
}

export interface EnrichedUsptoOptions {
  /** Hard cap on parallel TSDR lookups per search call. Default 5. */
  maxLookups?: number;
}

function extractSerialFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/caseNumber=(\d{6,9})/);
  return match ? match[1] : null;
}

/**
 * Wrap a USPTO base connector (e.g. Markbase) to cross-validate each mark's
 * status against the official USPTO TSDR record. When TSDR returns a different
 * status category than the base index, we trust TSDR (USPTO is authoritative)
 * and append a "[USPTO 官方状态: ...]" hint to the status string for evidence
 * transparency. TSDR failures are swallowed — the base result still wins.
 */
export class EnrichedUsptoConnector implements UsptoBasePort {
  private readonly maxLookups: number;

  constructor(
    private readonly base: UsptoBasePort,
    private readonly tsdr: LiveUsptoTsdrConnector,
    options: EnrichedUsptoOptions = {},
  ) {
    this.maxLookups = options.maxLookups ?? 5;
  }

  async searchMarks(term: string): Promise<{ marks: TrademarkSearchMark[] }> {
    const baseResult = await this.base.searchMarks(term);
    const marks = baseResult.marks;
    if (marks.length === 0) return baseResult;

    const lookups = marks.slice(0, this.maxLookups).map(async (mark, index) => {
      const serial = extractSerialFromUrl(mark.url);
      if (!serial) return { index, status: null };
      try {
        const status = await this.tsdr.getStatusBySerial(serial);
        return { index, status };
      } catch {
        return { index, status: null };
      }
    });

    const enrichedMarks: TrademarkSearchMark[] = marks.slice();
    for (const { index, status } of await Promise.all(lookups)) {
      if (!status || status.statusCategory === "UNKNOWN") continue;
      const baseMark = enrichedMarks[index];
      if (status.statusCategory === baseMark.status) continue;
      enrichedMarks[index] = {
        ...baseMark,
        status: status.statusCategory,
        url: status.detailUrl ?? baseMark.url,
      };
    }

    return { marks: enrichedMarks };
  }
}
