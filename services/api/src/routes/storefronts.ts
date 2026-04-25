import {
  StorefrontCandidateService,
  resolveAmazonConnector,
} from "@xiaochengxu/tools";
import type { FastifyInstance } from "fastify";

export async function registerStorefrontRoutes(app: FastifyInstance) {
  const amazon = resolveAmazonConnector();
  const service = new StorefrontCandidateService({
    async listStoreProducts(storeName: string) {
      if (!amazon.connector.listStoreProducts) {
        throw new Error(
          "Amazon storefront lookup is not configured — set AMAZON_STORE_URL_TEMPLATE",
        );
      }
      return amazon.connector.listStoreProducts(storeName);
    },
  });

  app.get("/api/storefronts/:storeName/products", async (request, reply) => {
    const { storeName } = request.params as { storeName: string };
    let result: Awaited<ReturnType<StorefrontCandidateService["run"]>>;

    try {
      result = await service.run(storeName);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Amazon storefront data source failed";
      return reply.code(503).send({
        code: "AMAZON_STOREFRONT_SOURCE_UNAVAILABLE",
        message,
        dataSource: amazon.source,
      });
    }

    return {
      ...result,
      dataSource: amazon.source,
    };
  });
}
