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
          summary: "New TRO complaint mentions monitored brand.",
        },
      },
      { sendEmail, sendSms, saveMessage },
    );

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendSms).toHaveBeenCalledOnce();
    expect(saveMessage).toHaveBeenCalledOnce();
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
          summary: "No new activity.",
        },
      },
      { sendEmail, sendSms, saveMessage },
    );

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(saveMessage).not.toHaveBeenCalled();
  });
});
