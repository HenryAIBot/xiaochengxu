import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CaseProgressService } from "../../services/api/src/services/case-progress-service.js";
import { InfringementCheckService } from "../../services/api/src/services/infringement-check-service.js";
import { StorefrontCandidateService } from "../../services/api/src/services/storefront-candidate-service.js";
import { TroAlertService } from "../../services/api/src/services/tro-alert-service.js";

describe("tool services", () => {
  it("builds a suspected_high tro alert summary from court hits", async () => {
    const service = new TroAlertService({
      search: async () =>
        JSON.parse(
          readFileSync("tests/fixtures/courtlistener-search.json", "utf8"),
        ),
      getDocket: async () =>
        JSON.parse(
          readFileSync("tests/fixtures/courtlistener-docket.json", "utf8"),
        ),
    });

    const result = await service.run("nike");

    expect(result.preview.level).toBe("suspected_high");
    expect(result.preview.summary).toContain("temporary restraining order");
  });

  it("builds a case timeline from docket entries", async () => {
    const service = new CaseProgressService({
      search: async () =>
        JSON.parse(
          readFileSync("tests/fixtures/courtlistener-search.json", "utf8"),
        ),
      getDocket: async () =>
        JSON.parse(
          readFileSync("tests/fixtures/courtlistener-docket.json", "utf8"),
        ),
    });

    const result = await service.run("1:25-cv-01234");

    expect(result.timeline[0]?.event).toContain("Temporary restraining order");
    expect(result.preview.level).toBe("watch");
  });

  it("builds an infringement report from Amazon and USPTO evidence", async () => {
    const service = new InfringementCheckService({
      getListingHtml: async () =>
        readFileSync("tests/fixtures/amazon-listing.html", "utf8"),
      searchMarks: async () =>
        JSON.parse(readFileSync("tests/fixtures/uspto-search.json", "utf8")),
    });

    const result = await service.run("B0C1234567");

    expect(result.preview.level).toBe("suspected_high");
    expect(result.listing.brand).toBe("nike");
  });

  it("returns representative products for a storefront search", async () => {
    const service = new StorefrontCandidateService({
      listStoreProducts: async () =>
        JSON.parse(
          readFileSync("tests/fixtures/storefront-products.json", "utf8"),
        ),
    });

    const result = await service.run("nike store");

    expect(result.items[0]?.asin).toBe("B0C1234567");
    expect(result.items).toHaveLength(2);
  });
});
