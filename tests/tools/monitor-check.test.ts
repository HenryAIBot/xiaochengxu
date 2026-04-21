import {
  createDefaultMonitorChecker,
  pickMonitorTool,
} from "@xiaochengxu/tools";
import { describe, expect, it } from "vitest";

describe("pickMonitorTool", () => {
  it("routes brand → infringement_check", () => {
    expect(pickMonitorTool("brand")).toEqual({
      tool: "infringement_check",
      inputKind: "brand",
    });
  });

  it("routes asin → infringement_check", () => {
    expect(pickMonitorTool("asin")).toEqual({
      tool: "infringement_check",
      inputKind: "asin",
    });
  });

  it("routes case_number → case_progress", () => {
    expect(pickMonitorTool("case_number")).toEqual({
      tool: "case_progress",
      inputKind: "case_number",
    });
  });

  it("routes store_name → tro_alert", () => {
    expect(pickMonitorTool("store_name")).toEqual({
      tool: "tro_alert",
      inputKind: "store_name",
    });
  });
});

describe("createDefaultMonitorChecker", () => {
  const runMonitorCheck = createDefaultMonitorChecker();

  it("returns a preview for a brand monitor using fixture data", async () => {
    const result = await runMonitorCheck({
      targetKind: "brand",
      targetValue: "apple",
    });
    expect(result.tool).toBe("infringement_check");
    expect(result.level).toBe("suspected_high");
    expect(result.dataSource).toBe("fixture");
  });

  it("returns clear level for an unknown brand", async () => {
    const result = await runMonitorCheck({
      targetKind: "brand",
      targetValue: "abracadabrabogusbrand",
    });
    expect(result.level).toBe("clear");
  });
});
