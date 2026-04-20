export type InputKind = "asin" | "brand" | "store_name" | "case_number";

export interface NormalizedInput {
  kind: InputKind;
  rawValue: string;
  normalizedValue: string;
}

export class BlankInputError extends Error {
  readonly code = "BLANK_INPUT" as const;

  constructor() {
    super("Input cannot be blank");
    this.name = "BlankInputError";
  }
}

const ASIN_TOKEN_RE = /^[A-Z0-9]{10}$/i;
const AMAZON_ASIN_PATH_RE =
  /^(?:\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/)([A-Z0-9]{10})(?:[/?#]|$)/i;
const CASE_RE = /^\d{1,2}:\d{2}-[a-z]{2}-\d{4,6}$/i;
const AMAZON_BASE_DOMAINS = [
  "amazon.com",
  "amazon.ca",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.nl",
  "amazon.se",
  "amazon.pl",
  "amazon.com.au",
  "amazon.com.br",
  "amazon.com.mx",
  "amazon.com.tr",
  "amazon.co.jp",
  "amazon.in",
  "amazon.sg",
  "amazon.ae",
  "amazon.sa",
  "amazon.com.be",
  "amazon.com.eg",
  "amazon.com.hk",
  "amazon.com.tw",
] as const;

function extractAsinFromAmazonUrl(trimmedValue: string): string | undefined {
  try {
    const url = new URL(
      trimmedValue.includes("://") ? trimmedValue : `https://${trimmedValue}`,
    );
    const hostname = url.hostname.toLowerCase();
    const isAmazonHost = AMAZON_BASE_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );

    if (!isAmazonHost) {
      return undefined;
    }

    const pathMatch = url.pathname.match(AMAZON_ASIN_PATH_RE);
    return pathMatch?.[1]?.toUpperCase();
  } catch {
    return undefined;
  }
}

export function normalizeInput(rawValue: string): NormalizedInput {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    throw new BlankInputError();
  }

  if (ASIN_TOKEN_RE.test(trimmed)) {
    return { kind: "asin", rawValue, normalizedValue: trimmed.toUpperCase() };
  }

  const asinFromUrl = extractAsinFromAmazonUrl(trimmed);
  if (asinFromUrl) {
    return { kind: "asin", rawValue, normalizedValue: asinFromUrl };
  }

  if (CASE_RE.test(trimmed)) {
    return {
      kind: "case_number",
      rawValue,
      normalizedValue: trimmed.toLowerCase(),
    };
  }

  if (/\s(store|shop)$/i.test(trimmed)) {
    return {
      kind: "store_name",
      rawValue,
      normalizedValue: trimmed.toLowerCase(),
    };
  }

  return { kind: "brand", rawValue, normalizedValue: trimmed.toLowerCase() };
}
