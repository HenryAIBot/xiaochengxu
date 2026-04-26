import {
  DataSourceError,
  classifyDataSourceError,
  createDefaultToolExecutor,
} from "@xiaochengxu/tools";
import { describe, expect, it } from "vitest";

describe("classifyDataSourceError", () => {
  it("classifies CourtListener errors with provider and friendly Chinese label", () => {
    const result = classifyDataSourceError(
      new Error(
        "CourtListener /api/rest/v4/search/?q=nike failed: 502 Bad Gateway",
      ),
    );
    expect(result.provider).toBe("courtlistener");
    expect(result.friendlyMessage).toContain("法院案件检索暂不可用");
    expect(result.friendlyMessage).toContain("供应商服务暂时不可用");
  });

  it("classifies Markbase errors as USPTO with limit-rate hint on 429", () => {
    const result = classifyDataSourceError(
      new Error("Markbase trademark search failed: 429 Too Many Requests"),
    );
    expect(result.provider).toBe("uspto");
    expect(result.friendlyMessage).toContain("USPTO 商标检索暂不可用");
    expect(result.friendlyMessage).toContain("供应商限流");
  });

  it("classifies Rainforest errors as Amazon with credentials hint on 401", () => {
    const result = classifyDataSourceError(
      new Error("Rainforest API product failed: 401 Unauthorized"),
    );
    expect(result.provider).toBe("amazon");
    expect(result.friendlyMessage).toContain("Amazon 商品查询暂不可用");
    expect(result.friendlyMessage).toContain("凭证或授权问题");
  });

  it("falls back to unknown provider with raw message embedded", () => {
    const result = classifyDataSourceError(
      new Error("Database connection refused"),
    );
    expect(result.provider).toBe("unknown");
    expect(result.friendlyMessage).toContain("Database connection refused");
  });

  it("recognises network timeout markers", () => {
    const result = classifyDataSourceError(
      new Error("CourtListener /api/... failed: ETIMEDOUT"),
    );
    expect(result.friendlyMessage).toContain("网络超时");
  });
});

describe("createDefaultToolExecutor surfaces friendly errors", () => {
  it("wraps connector failures from tro_alert as DataSourceError with friendly message", async () => {
    const runTool = createDefaultToolExecutor({
      courtListener: {
        connector: {
          async search() {
            throw new Error(
              "CourtListener /api/rest/v4/search/?q=x failed: 502 Bad Gateway",
            );
          },
          async getDocket() {
            return { entries: [] };
          },
        },
        source: "live",
      },
    });

    await expect(
      runTool({
        tool: "tro_alert",
        normalizedInput: { kind: "brand", rawValue: "x", normalizedValue: "x" },
      }),
    ).rejects.toMatchObject({
      name: "DataSourceError",
      provider: "courtlistener",
      message: expect.stringContaining("法院案件检索暂不可用"),
    });
  });

  it("does not double-wrap errors that are already DataSourceError", async () => {
    const original = new DataSourceError({
      provider: "amazon",
      friendlyMessage: "Amazon 商品查询暂不可用：网络超时",
      rawMessage: "rainforest down",
    });
    const runTool = createDefaultToolExecutor({
      amazon: {
        connector: {
          async getListingHtml() {
            throw original;
          },
        },
        source: "live",
      },
      uspto: {
        connector: {
          async searchMarks() {
            return { marks: [] };
          },
        },
        source: "live",
      },
    });

    await expect(
      runTool({
        tool: "infringement_check",
        normalizedInput: {
          kind: "asin",
          rawValue: "B0XXXXXXXX",
          normalizedValue: "B0XXXXXXXX",
        },
      }),
    ).rejects.toBe(original);
  });
});
