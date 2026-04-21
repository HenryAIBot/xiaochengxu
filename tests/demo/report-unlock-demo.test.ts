import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("demo report unlock flow", () => {
  const html = readFileSync("demo/index.html", "utf8");

  it("uses the real query report id and renders the unlocked full report", () => {
    expect(html).toContain("let latestReportId = null;");
    expect(html).toContain("latestReportId = data.reportId;");
    expect(html).toContain("fullReportUrl");
    expect(html).toContain("renderFullReport");
    expect(html).not.toContain("/api/reports/report-1/unlock");
  });
});
