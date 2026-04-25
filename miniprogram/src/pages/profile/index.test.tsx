import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./index";

const taro = vi.hoisted(() => ({
  getStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
}));

const didShow = vi.hoisted(() => ({
  callback: undefined as undefined | (() => void),
}));

const api = vi.hoisted(() => ({
  createConsultation: vi.fn(),
  listConsultations: vi.fn(),
  updateConsultation: vi.fn(),
}));

vi.mock("@tarojs/taro", () => ({
  default: taro,
  useDidShow: (callback: () => void) => {
    didShow.callback = callback;
  },
}));

vi.mock("../../lib/api", () => ({
  createConsultation: api.createConsultation,
  listConsultations: api.listConsultations,
  updateConsultation: api.updateConsultation,
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    taro.getStorageSync.mockReset();
    taro.removeStorageSync.mockReset();
    didShow.callback = undefined;
    api.createConsultation.mockReset();
    api.listConsultations.mockReset();
    api.updateConsultation.mockReset();
    api.listConsultations.mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("refreshes consultation context when the tab is shown again", async () => {
    taro.getStorageSync.mockReturnValue(undefined);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(api.listConsultations).toHaveBeenCalled();
    });

    taro.getStorageSync.mockReturnValueOnce({
      targetRef: { kind: "brand", value: "nike" },
      sourceReportId: "report-1",
      sourceQueryTaskId: "task-1",
      label: "TRO 预警 · nike",
      savedAt: Date.now(),
    });

    didShow.callback?.();

    await waitFor(() => {
      expect(screen.getByText("本次咨询对象：TRO 预警 · nike")).toBeTruthy();
    });
    expect(screen.getByText("品牌：nike")).toBeTruthy();
    expect(screen.getByText("关联报告：report-1")).toBeTruthy();
  });
});
