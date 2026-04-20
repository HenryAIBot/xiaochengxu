export interface StoreProduct {
  asin: string;
  title: string;
}

export class AmazonListingConnector {
  constructor(
    private readonly fetchHtml: (asin: string) => Promise<string>,
    private readonly fetchStoreProducts: (
      storeName: string,
    ) => Promise<{ items: StoreProduct[] }>,
  ) {}

  async getListingHtml(asin: string) {
    return this.fetchHtml(asin);
  }

  async listStoreProducts(storeName: string) {
    return this.fetchStoreProducts(storeName);
  }
}
