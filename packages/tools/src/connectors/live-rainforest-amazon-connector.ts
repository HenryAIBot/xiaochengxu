import type { StoreProduct } from "./amazon-listing-connector.js";

type FetchLike = typeof fetch;

export interface LiveRainforestAmazonOptions {
  apiKey: string;
  baseUrl?: string;
  amazonDomain?: string;
  fetchImpl?: FetchLike;
  maxStoreProducts?: number;
}

interface RainforestProduct {
  asin?: string;
  title?: string;
  brand?: string;
  feature_bullets?: string[];
  feature_bullets_flat?: string;
  description?: string;
  categories?: Array<{ name?: string }>;
  buybox_winner?: {
    price?: { raw?: string };
    availability?: { raw?: string };
  };
}

interface RainforestSearchResult {
  asin?: string;
  title?: string;
  brand?: string;
}

interface RainforestProductPayload {
  product?: RainforestProduct;
  request_info?: { success?: boolean; message?: string };
  request_metadata?: { amazon_url?: string };
}

interface RainforestStorePayload {
  seller_results?: RainforestSearchResult[];
  search_results?: RainforestSearchResult[];
  category_results?: RainforestSearchResult[];
  request_info?: { success?: boolean; message?: string };
}

function pickBullets(product: RainforestProduct): string[] {
  if (Array.isArray(product.feature_bullets)) {
    return product.feature_bullets.filter(Boolean).slice(0, 8);
  }
  if (product.feature_bullets_flat) {
    return product.feature_bullets_flat
      .split(/\s*[•|\n]\s*/g)
      .map((text) => text.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export class LiveRainforestAmazonConnector {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly amazonDomain: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxStoreProducts: number;

  constructor(options: LiveRainforestAmazonOptions) {
    if (!options.apiKey) {
      throw new Error("LiveRainforestAmazonConnector requires apiKey");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.rainforestapi.com/request";
    this.amazonDomain = options.amazonDomain ?? "amazon.com";
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxStoreProducts = options.maxStoreProducts ?? 10;
  }

  private buildUrl(params: Record<string, string>): string {
    const url = new URL(this.baseUrl);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("amazon_domain", this.amazonDomain);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private async request<T>(params: Record<string, string>): Promise<T> {
    const url = this.buildUrl(params);
    const response = await this.fetchImpl(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Rainforest API ${params.type} failed: ${response.status} ${response.statusText} ${detail}`,
      );
    }
    return (await response.json()) as T;
  }

  async getListingHtml(asin: string): Promise<string> {
    const payload = await this.request<RainforestProductPayload>({
      type: "product",
      asin,
    });
    if (!payload.product) {
      throw new Error(
        `Rainforest product response missing product for ${asin}`,
      );
    }

    const product = payload.product;
    const title = product.title ?? "";
    const brand = product.brand ?? "";
    const bullets = pickBullets(product);
    const description = product.description ?? "";
    const category =
      product.categories
        ?.map((item) => item.name)
        .filter(Boolean)
        .join(" > ") ?? "";
    const price = product.buybox_winner?.price?.raw ?? "";

    return `<html><body>
      <div id="productTitle">${escapeHtml(title)}</div>
      <div id="bylineInfo">Brand: ${escapeHtml(brand)}</div>
      <div id="priceblock_ourprice">${escapeHtml(price)}</div>
      <div id="wayfinding-breadcrumbs_feature_div">${escapeHtml(category)}</div>
      <div id="feature-bullets">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</div>
      <div id="productDescription">${escapeHtml(description)}</div>
    </body></html>`;
  }

  async listStoreProducts(
    storeName: string,
  ): Promise<{ items: StoreProduct[] }> {
    const trimmed = storeName.trim();
    const type = /^A[A-Z0-9]{8,}$/.test(trimmed) ? "seller_products" : "search";
    const payload = await this.request<RainforestStorePayload>(
      type === "seller_products"
        ? { type, seller_id: trimmed }
        : { type, search_term: trimmed },
    );
    const raw =
      payload.seller_results ??
      payload.search_results ??
      payload.category_results ??
      [];

    return {
      items: raw
        .flatMap((row) => {
          if (!row.asin || !row.title) return [];
          return [{ asin: row.asin, title: row.title }];
        })
        .slice(0, this.maxStoreProducts),
    };
  }
}
