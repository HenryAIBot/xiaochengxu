import { describe, expect, it, vi } from "vitest";
import { runMonitorProcessor } from "../../services/jobs/src/processors/monitor-processor.js";

function makePorts() {
  return {
    sendEmail: vi.fn(async () => ({ delivered: true })),
    sendSms: vi.fn(async () => ({ delivered: true })),
    saveMessage: vi.fn(async () => ({ saved: true })),
  };
}

describe("monitor processor", () => {
  it("sends email and sms when both recipients are present", async () => {
    const ports = makePorts();

    const result = await runMonitorProcessor(
      {
        monitorId: "monitor-1",
        notifyEmail: "seller@example.com",
        notifyPhone: "+8613800138000",
        preview: {
          level: "suspected_high",
          summary: "监控品牌出现新的临时限制令投诉。",
        },
      },
      ports,
    );

    expect(result).toEqual({ skipped: false, delivered: ["email", "sms"] });
    expect(ports.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "seller@example.com",
        subject: "监控 monitor-1 命中疑似高风险",
      }),
    );
    expect(ports.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+8613800138000",
        body: "疑似高风险：监控品牌出现新的临时限制令投诉。",
      }),
    );
    expect(ports.saveMessage).toHaveBeenCalledTimes(2);
    expect(ports.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        monitorId: "monitor-1",
        level: "suspected_high",
        channel: "email",
        to: "seller@example.com",
      }),
    );
    expect(ports.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "sms",
        to: "+8613800138000",
      }),
    );
  });

  it("only sends email when phone is missing", async () => {
    const ports = makePorts();

    const result = await runMonitorProcessor(
      {
        monitorId: "monitor-2",
        notifyEmail: "seller@example.com",
        notifyPhone: null,
        preview: {
          level: "watch",
          summary: "需要关注的新品投诉。",
        },
      },
      ports,
    );

    expect(result).toEqual({ skipped: false, delivered: ["email"] });
    expect(ports.sendEmail).toHaveBeenCalledOnce();
    expect(ports.sendSms).not.toHaveBeenCalled();
    expect(ports.saveMessage).toHaveBeenCalledOnce();
    expect(ports.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "email" }),
    );
  });

  it("only sends sms when email is missing", async () => {
    const ports = makePorts();

    const result = await runMonitorProcessor(
      {
        monitorId: "monitor-3",
        notifyPhone: "+8613900139000",
        preview: {
          level: "confirmed",
          summary: "已确认风险。",
        },
      },
      ports,
    );

    expect(result).toEqual({ skipped: false, delivered: ["sms"] });
    expect(ports.sendEmail).not.toHaveBeenCalled();
    expect(ports.sendSms).toHaveBeenCalledOnce();
    expect(ports.saveMessage).toHaveBeenCalledOnce();
    expect(ports.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "sms" }),
    );
  });

  it("logs a system message when no notification channel is configured", async () => {
    const ports = makePorts();

    const result = await runMonitorProcessor(
      {
        monitorId: "monitor-4",
        preview: {
          level: "watch",
          summary: "新增一条监控命中。",
        },
      },
      ports,
    );

    expect(result).toEqual({ skipped: false, delivered: [] });
    expect(ports.sendEmail).not.toHaveBeenCalled();
    expect(ports.sendSms).not.toHaveBeenCalled();
    expect(ports.saveMessage).toHaveBeenCalledOnce();
    expect(ports.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "system",
        to: null,
      }),
    );
  });

  it("skips notifications when the preview is clear", async () => {
    const ports = makePorts();

    const result = await runMonitorProcessor(
      {
        monitorId: "monitor-5",
        notifyEmail: "seller@example.com",
        notifyPhone: "+8613800138000",
        preview: {
          level: "clear",
          summary: "暂无新的风险动态。",
        },
      },
      ports,
    );

    expect(result).toEqual({ skipped: true });
    expect(ports.sendEmail).not.toHaveBeenCalled();
    expect(ports.sendSms).not.toHaveBeenCalled();
    expect(ports.saveMessage).not.toHaveBeenCalled();
  });
});
