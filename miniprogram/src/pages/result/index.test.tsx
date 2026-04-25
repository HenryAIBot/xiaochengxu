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
  setStorageSync: vi.fn(),
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  request: vi.fn(),
  switchTab: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@tarojs/taro", () => ({
  default: taro,
}));

const cachedCompletedResult = {
  id: "task-1",
  reportId: "report-1",
  status: "completed",
  tool: "tro_alert",
  normalizedInput: { kind: "brand", normalizedValue: "nike" },
  level: "suspected_high",
  levelLabel: "疑似高风险",
  summary: "检测到近期 TRO 案件信号。",
  evidence: [],
  recommendedActions: ["加入持续监控"],
  dataSource: "fixture",
};

describe("ResultPage", () => {
  beforeEach(() => {
    taro.getCurrentInstance.mockReset();
    taro.getStorageSync.mockReset();
    taro.setStorageSync.mockReset();
    taro.request.mockReset();
    taro.navigateTo.mockReset();
    taro.navigateBack.mockReset();
    taro.switchTab.mockReset();
    taro.getCurrentInstance.mockReturnValue({
      router: { params: { id: "task-1" } },
    });
    // Pre-populate a fake token so buildAuthHeader doesn't try to fetch
    // one from the API and consume the test's request mocks.
    taro.getStorageSync.mockImplementation((key: string) =>
      key === "userToken" ? "test-token" : undefined,
    );
    taro.request.mockResolvedValue({
      data: { id: "monitor-1", status: "active" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the cached completed result and creates a monitor", async () => {
    taro.getStorageSync.mockImplementation((key: string) =>
      key === "queryResult:task-1" ? cachedCompletedResult : undefined,
    );

    render(<ResultPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "加入监控" })).toBeTruthy();
    });
    expect(screen.getByText("演示数据（非真实 API）")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "加入监控" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入监控" }));

    await waitFor(() => {
      expect(taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "http://127.0.0.1:3000/api/monitors",
          method: "POST",
          data: {
            targetKind: "brand",
            targetValue: "nike",
            tickIntervalSeconds: 900,
          },
        }),
      );
    });
    expect(taro.switchTab).toHaveBeenCalledWith({
      url: "/pages/monitor/index",
    });
  });

  it("shows loading then renders the completed result after polling", async () => {
    taro.getStorageSync.mockImplementation((key: string) =>
      key === "userToken" ? "test-token" : undefined,
    );
    taro.request.mockReset();
    taro.request.mockResolvedValue({
      data: {
        taskId: "task-1",
        status: "completed",
        tool: "tro_alert",
        normalizedInput: { kind: "brand", normalizedValue: "nike" },
        createdAt: "2026-04-21T00:00:00Z",
        reportId: "report-9",
        result: {
          level: "suspected_high",
          levelLabel: "疑似高风险",
          summary: "发现相关 TRO 案件。",
          evidence: [],
          recommendedActions: ["加入持续监控"],
          dataSource: "fixture",
        },
      },
    });

    render(<ResultPage />);

    expect(screen.getByText(/检测中/)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "加入监控" })).toBeTruthy();
    });
    expect(taro.setStorageSync).toHaveBeenCalledWith(
      "queryResult:task-1",
      expect.objectContaining({ reportId: "report-9" }),
    );
  });

  it("keeps report context when advisor-like recommended actions are tapped", async () => {
    taro.getStorageSync.mockImplementation((key: string) =>
      key === "queryResult:task-1"
        ? {
            ...cachedCompletedResult,
            recommendedActions: ["联系顾问复核"],
          }
        : undefined,
    );

    render(<ResultPage />);

    await waitFor(() => {
      expect(screen.getByText("联系顾问复核")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("联系顾问复核"));

    expect(taro.setStorageSync).toHaveBeenCalledWith(
      "consultationContext",
      expect.objectContaining({
        targetRef: { kind: "brand", value: "nike" },
        sourceReportId: "report-1",
        sourceQueryTaskId: "task-1",
        label: "TRO 预警 · nike",
      }),
    );
    expect(taro.switchTab).toHaveBeenCalledWith({
      url: "/pages/profile/index",
    });
  });

  it("shows a failed state when the polled task failed and allows retry", async () => {
    taro.getStorageSync.mockImplementation((key: string) =>
      key === "userToken" ? "test-token" : undefined,
    );
    taro.request.mockReset();
    taro.request.mockResolvedValueOnce({
      data: {
        taskId: "task-1",
        status: "failed",
        tool: "tro_alert",
        normalizedInput: { kind: "brand", normalizedValue: "nike" },
        createdAt: "2026-04-21T00:00:00Z",
        failureReason: "CourtListener 不可达",
      },
    });

    render(<ResultPage />);

    await waitFor(() => {
      expect(screen.getByText("CourtListener 不可达")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "返回首页" })).toBeTruthy();
  });
});
