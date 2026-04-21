import { readFileSync } from "node:fs";
import {
  CaseProgressService,
  InfringementCheckService,
  StorefrontCandidateService,
  TroAlertService,
} from "@xiaochengxu/tools";
import { describe, expect, it } from "vitest";

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
    expect(result.preview.summary).toContain("发现相关临时限制令案件");
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

    expect(result.timeline[0]?.event).toContain("法院已签发临时限制令");
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

  it("checks a brand term against USPTO directly instead of treating it as an ASIN", async () => {
    const service = new InfringementCheckService({
      getListingHtml: async () => {
        throw new Error("brand inputs should not fetch Amazon listing HTML");
      },
      searchMarks: async (term) => ({
        marks:
          term === "apple"
            ? [
                { owner: "Apple Inc.", mark: "APPLE", status: "LIVE" },
                { owner: "Apple Inc.", mark: "IPHONE", status: "LIVE" },
                { owner: "Apple Inc.", mark: "AIRPODS", status: "LIVE" },
              ]
            : [],
      }),
    });

    const result = await service.run("apple", "brand");

    expect(result.preview.level).toBe("suspected_high");
    expect(result.preview.summary).toContain(
      "权利人 Apple Inc. 名下有效商标：APPLE、IPHONE、AIRPODS",
    );
    expect(result.preview.evidence).toHaveLength(1);
    expect(result.listing).toMatchObject({
      brand: "apple",
      inputKind: "brand",
    });
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
