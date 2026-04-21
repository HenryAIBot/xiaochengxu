import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResultPage from "./index";

const taro = vi.hoisted(() => ({
  getCurrentInstance: vi.fn(),
  getStorageSync: vi.fn(),
  navigateTo: vi.fn(),
  request: vi.fn(),
  switchTab: vi.fn(),
}));

vi.mock("@tarojs/taro", () => ({
  default: taro,
}));

describe("ResultPage", () => {
  beforeEach(() => {
    taro.getCurrentInstance.mockReturnValue({
      router: { params: { id: "task-1" } },
    });
    taro.getStorageSync.mockImplementation((key: string) => {
      if (key !== "queryResult:task-1") {
        return undefined;
      }

      return {
        id: "task-1",
        reportId: "report-1",
        status: "completed",
        tool: "tro_alert",
        normalizedInput: {
          kind: "brand",
          normalizedValue: "nike",
        },
        level: "suspected_high",
        levelLabel: "疑似高风险",
        summary: "检测到近期 TRO 案件信号。",
        evidence: [],
        recommendedActions: ["加入持续监控"],
      };
    });
    taro.request.mockResolvedValue({
      data: {
        id: "monitor-1",
        status: "active",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates a monitor from the current query before opening the monitor tab", async () => {
    render(<ResultPage />);

    fireEvent.click(screen.getByRole("button", { name: "加入监控" }));

    await waitFor(() => {
      expect(taro.request).toHaveBeenCalledWith({
        url: "http://127.0.0.1:3000/api/monitors",
        method: "POST",
        header: { "Content-Type": "application/json" },
        data: {
          targetKind: "brand",
          targetValue: "nike",
        },
      });
    });
    expect(taro.switchTab).toHaveBeenCalledWith({
      url: "/pages/monitor/index",
    });
  });
});
