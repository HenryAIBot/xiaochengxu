import { CaseProgressService } from "@xiaochengxu/tools";
import { describe, expect, it } from "vitest";

describe("CaseProgressService", () => {
  it("attaches the first available recap document URL to each evidence signal", async () => {
    const service = new CaseProgressService({
      async search() {
        return { results: [] };
      },
      async getDocket() {
        return {
          entries: [
            {
              date: "2026-04-18",
              description: "Temporary restraining order entered.",
              documents: [
                {
                  description: "TRO Order",
                  url: "https://courtlistener.test/recap/.../tro-order",
                  pageCount: 8,
                  isAvailable: true,
                },
                {
                  description: "Sealed Exhibit",
                  url: "https://courtlistener.test/recap/.../sealed",
                  isAvailable: false,
                },
              ],
            },
            {
              date: "2026-04-12",
              description: "Complaint filed.",
            },
          ],
        };
      },
    });

    const result = await service.run("2:24-cv-03721");

    expect(result.timeline).toEqual([
      {
        at: "2026-04-18",
        event: "法院已签发临时限制令",
        documents: [
          {
            description: "TRO Order",
            url: "https://courtlistener.test/recap/.../tro-order",
            pageCount: 8,
            isAvailable: true,
          },
          {
            description: "Sealed Exhibit",
            url: "https://courtlistener.test/recap/.../sealed",
            isAvailable: false,
          },
        ],
      },
      { at: "2026-04-12", event: "原告已提交起诉状" },
    ]);

    const evidence = result.preview.evidence;
    expect(evidence[0]).toMatchObject({
      reason: expect.stringContaining("（2 份附件可查看）"),
      originalUrl: "https://courtlistener.test/recap/.../tro-order",
    });
    expect(evidence[1]).toMatchObject({
      reason: expect.stringContaining("原告已提交起诉状"),
    });
    expect(evidence[1]).not.toHaveProperty("originalUrl");
  });

  it("falls back to a sealed document URL only when nothing else is available", async () => {
    const service = new CaseProgressService({
      async search() {
        return { results: [] };
      },
      async getDocket() {
        return {
          entries: [
            {
              date: "2026-03-01",
              description: "Motion sealed by court order.",
              documents: [
                {
                  description: "Sealed Motion",
                  url: "https://courtlistener.test/recap/.../sealed-only",
                  isAvailable: false,
                },
              ],
            },
          ],
        };
      },
    });

    const result = await service.run("1:25-cv-99999");
    // No isAvailable !== false document, so originalUrl should be omitted.
    expect(result.preview.evidence[0]).not.toHaveProperty("originalUrl");
  });
});
