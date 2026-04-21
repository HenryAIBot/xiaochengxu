import { describe, expect, it, vi } from "vitest";
import { runMonitorProcessor } from "../../services/jobs/src/processors/monitor-processor.js";

describe("monitor processor", () => {
  it("sends both email and sms when a monitor hit escalates", async () => {
    const sendEmail = vi.fn(async () => ({ delivered: true }));
    const sendSms = vi.fn(async () => ({ delivered: true }));
    const saveMessage = vi.fn(async () => ({ saved: true }));

    await runMonitorProcessor(
      {
        monitorId: "monitor-1",
        preview: {
          level: "suspected_high",
          summary: "监控品牌出现新的临时限制令投诉。",
        },
      },
      { sendEmail, sendSms, saveMessage },
    );

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendSms).toHaveBeenCalledOnce();
    expect(saveMessage).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "监控 monitor-1 命中疑似高风险",
      }),
    );
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "疑似高风险：监控品牌出现新的临时限制令投诉。",
      }),
    );
  });

  it("skips notifications when the preview is clear", async () => {
    const sendEmail = vi.fn(async () => ({ delivered: true }));
    const sendSms = vi.fn(async () => ({ delivered: true }));
    const saveMessage = vi.fn(async () => ({ saved: true }));

    await runMonitorProcessor(
      {
        monitorId: "monitor-2",
        preview: {
          level: "clear",
          summary: "暂无新的风险动态。",
        },
      },
      { sendEmail, sendSms, saveMessage },
    );

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(saveMessage).not.toHaveBeenCalled();
  });
});
