const MOCK_LISTINGS: Record<string, { title: string; brand: string }> = {
  B0C1234567: {
    title: "Nike Air Max 270 Running Shoes Men's Athletic Sneakers",
    brand: "nike",
  },
  B0C7654321: {
    title: "Adidas Ultraboost Light Running Shoe Black White",
    brand: "adidas",
  },
  B0D1111111: {
    title: "New Balance 574 Classic Retro Running Shoe",
    brand: "new_balance",
  },
};

export class MockAmazonListingConnector {
  async getListingHtml(asin: string) {
    const key = asin.toUpperCase();
    const listing = MOCK_LISTINGS[key] ?? {
      title: `${asin} Generic Product Listing - Sports Style`,
      brand: key.slice(0, 4),
    };
    return `<html><body data-title="${listing.title}" data-brand="${listing.brand}"></body></html>`;
  }
}
