type FetchLike = typeof fetch;

export interface LiveUsptoTsdrOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export interface UsptoTsdrStatus {
  serialNumber: string;
  mark?: string;
  owner?: string;
  statusCategory: "LIVE" | "DEAD" | "UNKNOWN";
  statusDescription?: string;
  statusDate?: string;
  detailUrl: string;
}

const LIVE_PATTERNS = [
  /^registered\b/i,
  /^renewed\b/i,
  /^published\b/i,
  /^approved\b/i,
  /^new application\b/i,
  /^awaiting examination\b/i,
  /\blive\b/i,
];

const DEAD_PATTERNS = [
  /^dead\b/i,
  /^abandoned\b/i,
  /^cancel(?:l|led|lation)\b/i,
  /^expired\b/i,
  /\bdead\b/i,
];

function inferStatusCategory(
  description: string | undefined,
): UsptoTsdrStatus["statusCategory"] {
  if (!description) return "UNKNOWN";
  const trimmed = description.trim();
  for (const re of DEAD_PATTERNS) if (re.test(trimmed)) return "DEAD";
  for (const re of LIVE_PATTERNS) if (re.test(trimmed)) return "LIVE";
  return "UNKNOWN";
}

function extract(xml: string, localName: string): string | undefined {
  // Match an element by local name, ignoring any XML namespace prefix.
  const re = new RegExp(
    `<(?:[^:>\\s/]+:)?${localName}\\b[^>]*>([^<]+)<\\/(?:[^:>\\s/]+:)?${localName}>`,
    "i",
  );
  const match = xml.match(re);
  return match?.[1]?.trim();
}

function extractOwner(xml: string): string | undefined {
  // Owner can be either an organization or a natural person; try both.
  return (
    extract(xml, "OrganizationStandardName") ??
    extract(xml, "OrganizationName") ??
    extract(xml, "PersonFullName") ??
    extract(xml, "PartyName")
  );
}

function tsdrDetailUrl(serialNumber: string): string {
  return `https://tsdr.uspto.gov/#caseNumber=${serialNumber}&caseType=SERIAL_NO&searchType=statusSearch`;
}

export class LiveUsptoTsdrConnector {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: LiveUsptoTsdrOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://tsdr.uspto.gov").replace(
      /\/+$/,
      "",
    );
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async getStatusBySerial(
    serialNumber: string,
  ): Promise<UsptoTsdrStatus | null> {
    if (!/^\d{6,9}$/.test(serialNumber)) return null;
    const url = `${this.baseUrl}/ts/cd/casestatus/sn${serialNumber}/info.xml`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { Accept: "application/xml" },
      });
    } catch {
      return null;
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `USPTO TSDR ${serialNumber} failed: ${response.status} ${response.statusText}`,
      );
    }
    const xml = await response.text();
    const statusDescription = extract(
      xml,
      "MarkCurrentStatusExternalDescriptionText",
    );
    return {
      serialNumber,
      mark: extract(xml, "MarkVerbalElementText"),
      owner: extractOwner(xml),
      statusCategory: inferStatusCategory(statusDescription),
      ...(statusDescription ? { statusDescription } : {}),
      ...(extract(xml, "MarkCurrentStatusDate")
        ? { statusDate: extract(xml, "MarkCurrentStatusDate") as string }
        : {}),
      detailUrl: tsdrDetailUrl(serialNumber),
    };
  }
}
