import type { StoreProduct } from "./amazon-listing-connector.js";

type FetchLike = typeof fetch;

export interface LiveAmazonOptions {
  /**
   * URL template invoked for listing HTML. `{asin}` / `{asinEncoded}` are
   * substituted with the ASIN. The backing service is expected to return
   * either raw HTML of an Amazon product page, OR a JSON body with a
   * `html` string field.
   *
   * Example:
   *   https://your-amazon-proxy.example/listing?asin={asin}
   */
  listingUrlTemplate: string;
  /**
   * Optional URL template for store product lookup, substituting
   * `{store}` / `{storeEncoded}`. Must return JSON shaped like
   * `{ items: [{ asin, title }] }`.
   */
  storeUrlTemplate?: string;
  /** Optional Authorization header value forwarded upstream. */
  authHeader?: string;
  fetchImpl?: FetchLike;
}

function substitute(template: string, name: "asin" | "store", value: string) {
  return template
    .replace(new RegExp(`\\{${name}\\}`, "g"), value)
    .replace(
      new RegExp(`\\{${name}Encoded\\}`, "g"),
      encodeURIComponent(value),
    );
}

export class LiveAmazonListingConnector {
  constructor(private readonly options: LiveAmazonOptions) {}

  private async fetch(url: string): Promise<Response> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const headers: Record<string, string> = {};
    if (this.options.authHeader)
      headers.Authorization = this.options.authHeader;
    return fetchImpl(url, { headers });
  }

  async getListingHtml(asin: string): Promise<string> {
    const url = substitute(this.options.listingUrlTemplate, "asin", asin);
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(
        `Amazon proxy HTTP ${response.status} ${response.statusText} for ASIN ${asin}`,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { html?: string };
      if (typeof body.html !== "string") {
        throw new Error(
          `Amazon proxy JSON response for ${asin} missing "html" field`,
        );
      }
      return body.html;
    }
    return response.text();
  }

  async listStoreProducts(
    storeName: string,
  ): Promise<{ items: StoreProduct[] }> {
    if (!this.options.storeUrlTemplate) {
      throw new Error(
        "Amazon live connector has no storeUrlTemplate configured — set AMAZON_STORE_URL_TEMPLATE or fall back to fixture",
      );
    }
    const url = substitute(this.options.storeUrlTemplate, "store", storeName);
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(
        `Amazon store proxy HTTP ${response.status} ${response.statusText} for store ${storeName}`,
      );
    }
    const body = (await response.json()) as
      | { items?: Array<{ asin?: unknown; title?: unknown }> }
      | Array<{ asin?: unknown; title?: unknown }>;
    const raw = Array.isArray(body) ? body : (body.items ?? []);
    const items: StoreProduct[] = raw.flatMap((row) => {
      if (
        typeof row.asin !== "string" ||
        typeof row.title !== "string" ||
        !row.asin.length ||
        !row.title.length
      ) {
        return [];
      }
      return [{ asin: row.asin, title: row.title }];
    });
    return { items };
  }
}
