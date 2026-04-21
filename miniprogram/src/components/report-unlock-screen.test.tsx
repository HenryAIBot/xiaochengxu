import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportUnlockScreen } from "./report-unlock-screen";

describe("ReportUnlockScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("unlocks the full report with email only", async () => {
    const onUnlock = vi.fn();

    render(<ReportUnlockScreen onUnlock={onUnlock} />);

    fireEvent.change(screen.getByPlaceholderText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "解锁完整报告" }));

    expect(onUnlock).toHaveBeenCalledWith({ email: "seller@example.com" });
    await waitFor(() => {
      expect(screen.getByText("完整报告已解锁")).toBeTruthy();
    });
  });

  it("unlocks the full report with phone only", () => {
    const onUnlock = vi.fn();

    render(<ReportUnlockScreen onUnlock={onUnlock} />);

    fireEvent.change(screen.getByPlaceholderText("手机号"), {
      target: { value: "+15551234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "解锁完整报告" }));

    expect(onUnlock).toHaveBeenCalledWith({ phone: "+15551234567" });
  });

  it("asks for email or phone before submitting", () => {
    const onUnlock = vi.fn();

    render(<ReportUnlockScreen onUnlock={onUnlock} />);

    fireEvent.click(screen.getByRole("button", { name: "解锁完整报告" }));

    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByText("请输入邮箱或手机号")).toBeTruthy();
  });

  it("shows the full report returned after unlock", async () => {
    const onUnlock = vi.fn().mockResolvedValue({
      id: "report-1",
      unlocked: true,
      query: {
        taskId: "task-1",
        tool: "tro_alert",
        inputKind: "brand",
        rawInput: "nike",
        normalizedInput: "nike",
        createdAt: "2026-04-21T10:30:00.000Z",
      },
      preview: {
        level: "suspected_high",
        summary: "检测到近期 TRO 案件信号。",
        evidence: [
          {
            source: "courtlistener",
            level: "suspected_high",
            reason: "相关品牌近期出现联邦法院案件。",
          },
        ],
        recommendedActions: ["立即复核 Listing 品牌词"],
        extra: null,
      },
    });

    render(<ReportUnlockScreen onUnlock={onUnlock} />);

    fireEvent.change(screen.getByPlaceholderText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "解锁完整报告" }));

    await waitFor(() => {
      expect(screen.getByText("完整报告")).toBeTruthy();
    });

    expect(screen.getByText("查询对象：nike")).toBeTruthy();
    expect(screen.getByText("检测到近期 TRO 案件信号。")).toBeTruthy();
    expect(screen.getByText("相关品牌近期出现联邦法院案件。")).toBeTruthy();
    expect(screen.getByText("立即复核 Listing 品牌词")).toBeTruthy();
  });
});
