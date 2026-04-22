import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MonitorPage from "./index";

const taro = vi.hoisted(() => ({
  request: vi.fn(),
  getStorageSync: vi.fn(() => "test-token"),
}));

vi.mock("@tarojs/taro", () => ({
  default: taro,
}));

describe("MonitorPage", () => {
  beforeEach(() => {
    taro.request.mockResolvedValue({
      data: {
        items: [
          {
            id: "monitor-1",
            targetKind: "brand",
            targetValue: "adidas",
            status: "active",
          },
        ],
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads monitors from the API instead of rendering a hard-coded sample", async () => {
    render(<MonitorPage />);

    await waitFor(() => {
      expect(taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "http://127.0.0.1:3000/api/monitors",
          method: "GET",
        }),
      );
    });
    expect(screen.getByText("adidas")).toBeTruthy();
  });
});
