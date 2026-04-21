import { describe, expect, it } from "vitest";
import { toResultViewModel } from "./query-result-view-model";

describe("query result view model", () => {
  it("maps a query task result into result screen props", () => {
    const result = toResultViewModel({
      id: "task-1",
      reportId: "report-1",
      status: "completed",
      normalizedInput: {
        kind: "brand",
        normalizedValue: "nike",
      },
      level: "suspected_high",
      levelLabel: "疑似高风险",
      summary: "发现相关临时限制令案件：Nike Inc v. Online Sellers Group",
      evidence: [
        {
          source: "courtlistener",
          level: "suspected_high",
          reason: "发现相关临时限制令案件：Nike Inc v. Online Sellers Group",
        },
      ],
      recommendedActions: ["立即复核商品页", "加入持续监控"],
    });

    expect(result).toMatchObject({
      taskId: "task-1",
      reportId: "report-1",
      toolName: "TRO 预警",
      level: "疑似高风险",
      summary: "发现相关临时限制令案件：Nike Inc v. Online Sellers Group",
      actions: ["立即复核商品页", "加入持续监控"],
    });
    expect(result.evidence).toEqual([
      {
        id: "courtlistener-0",
        title: "法院案件信号",
        source: "美国法院记录",
        matchedField: "风险信号",
        description: "发现相关临时限制令案件：Nike Inc v. Online Sellers Group",
      },
    ]);
  });

  it("falls back to safe labels when evidence or tool data is missing", () => {
    const result = toResultViewModel({
      id: "task-2",
      reportId: "report-2",
      status: "completed",
      normalizedInput: {
        kind: "asin",
        normalizedValue: "B0C1234567",
      },
      level: "watch",
      levelLabel: "需关注",
      summary: "暂无命中记录",
      evidence: [],
      recommendedActions: [],
    });

    expect(result.toolName).toBe("侵权体检");
    expect(result.evidence).toEqual([]);
    expect(result.actions).toEqual(["继续观察"]);
  });
});
