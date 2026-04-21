interface StorefrontPort {
  listStoreProducts(
    storeName: string,
  ): Promise<{ items: Array<{ asin: string; title: string }> }>;
}

export class StorefrontCandidateService {
  constructor(private readonly port: StorefrontPort) {}

  async run(storeName: string) {
    const payload = await this.port.listStoreProducts(storeName);

    return {
      storeName,
      items: payload.items.slice(0, 5),
    };
  }
}
