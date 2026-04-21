import type { FastifyInstance } from "fastify";

export async function registerStorefrontRoutes(app: FastifyInstance) {
  app.get("/api/storefronts/:storeName/products", async (request) => {
    const { storeName } = request.params as { storeName: string };

    return {
      items: [
        { asin: "B0C1234567", title: `${storeName} 代表商品 1` },
        { asin: "B0C7654321", title: `${storeName} 代表商品 2` },
      ],
    };
  });
}
