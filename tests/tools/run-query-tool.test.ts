import { createDefaultToolExecutor } from "@xiaochengxu/tools";
import { describe, expect, it } from "vitest";

describe("createDefaultToolExecutor", () => {
  const runTool = createDefaultToolExecutor();

  it("dispatches tro_alert to the TroAlert service", async () => {
    const result = await runTool({
      tool: "tro_alert",
      normalizedInput: {
        kind: "brand",
        rawValue: "nike",
        normalizedValue: "nike",
      },
    });
    expect(result.level).toBe("suspected_high");
    expect(result.dataSource).toBe("fixture");
    expect(Array.isArray(result.evidence)).toBe(true);
  });

  it("dispatches infringement_check with brand input to USPTO directly", async () => {
    const result = await runTool({
      tool: "infringement_check",
      normalizedInput: {
        kind: "brand",
        rawValue: "apple",
        normalizedValue: "apple",
      },
    });
    expect(result.level).toBe("suspected_high");
    expect(result.summary).toContain("权利人 Apple Inc.");
    expect(result.dataSource).toBe("fixture");
  });

  it("dispatches case_progress and returns a timeline in extra", async () => {
    const result = await runTool({
      tool: "case_progress",
      normalizedInput: {
        kind: "case_number",
        rawValue: "1:25-cv-01234",
        normalizedValue: "1:25-cv-01234",
      },
    });
    expect(result.level).toBe("watch");
    expect(result.dataSource).toBe("fixture");
    expect(result.extra).toMatchObject({
      timeline: expect.any(Array),
    });
  });
});
