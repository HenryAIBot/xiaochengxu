import { InfringementCheckService } from "@xiaochengxu/tools";
import { describe, expect, it, vi } from "vitest";

describe("InfringementCheckService", () => {
  it("falls back to product title when the listing brand field is blank", async () => {
    const searchMarks = vi.fn(async () => ({
      marks: [
        {
          owner: "Nike, Inc.",
          mark: "NIKE",
          status: "LIVE",
        },
      ],
    }));
    const service = new InfringementCheckService({
      getListingHtml: async () =>
        '<div>Brand: </div><span id="productTitle">Nike Men\'s Road Running Shoes</span>',
      searchMarks,
    });

    const result = await service.run("B0DPHRHRDL", "asin");

    expect(searchMarks).toHaveBeenCalledWith("nike");
    expect(result.listing.brand).toBe("nike");
    expect(result.preview.level).toBe("suspected_high");
  });
});
