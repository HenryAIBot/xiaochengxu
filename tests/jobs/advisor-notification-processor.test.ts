import { describe, expect, it, vi } from "vitest";
import { runAdvisorNotificationProcessor } from "../../services/jobs/src/processors/advisor-notification-processor.js";

describe("advisor-notification-processor", () => {
  it("sends an email when the advisor has an email address", async () => {
    const sendEmail = vi.fn(async () => ({
      delivered: true,
      transport: "smtp",
      messageId: "m-1",
    }));

    const result = await runAdvisorNotificationProcessor(
      {
        consultationId: "c-1",
        advisorId: "a-1",
        advisorName: "陈顾问",
        advisorEmail: "chen@advisor.example",
        clientName: "张三",
        clientPhone: "+8613800138000",
        note: "侵权体检命中高风险",
        targetRef: { kind: "brand", value: "nike" },
        sourceReportId: "r-abc",
      },
      { sendEmail },
    );

    expect(result).toEqual({
      consultationId: "c-1",
      advisorId: "a-1",
      emailed: true,
      transport: "smtp",
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    const call = sendEmail.mock.calls[0][0];
    expect(call.to).toBe("chen@advisor.example");
    expect(call.subject).toContain("张三");
    expect(call.subject).toContain("nike");
    expect(call.html).toContain("+8613800138000");
    expect(call.html).toContain("侵权体检命中高风险");
    expect(call.html).toContain("品牌");
    expect(call.html).toContain("nike");
    expect(call.html).toContain("r-abc");
  });

  it("skips silently when the advisor has no email", async () => {
    const sendEmail = vi.fn();
    const result = await runAdvisorNotificationProcessor(
      {
        consultationId: "c-2",
        advisorId: "a-2",
        advisorName: "林顾问",
        advisorEmail: null,
        clientName: "李四",
        clientPhone: "+15551234567",
        note: null,
        targetRef: null,
        sourceReportId: null,
      },
      { sendEmail },
    );
    expect(result.emailed).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
