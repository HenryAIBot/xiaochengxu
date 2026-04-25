import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminDlqPage from "./index";

const taro = vi.hoisted(() => ({
  request: vi.fn(),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@tarojs/taro", () => ({
  default: taro,
}));

describe("AdminDlqPage", () => {
  beforeEach(() => {
    taro.request.mockReset();
    taro.getStorageSync.mockReset();
    taro.setStorageSync.mockReset();
    taro.showToast.mockReset();
    taro.getStorageSync.mockImplementation((key: string) =>
      key === "internalToken" ? "dev-internal-secret" : undefined,
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("renders failed jobs fetched from the internal endpoint", async () => {
    taro.request.mockImplementation(async (opts: { url: string }) => {
      if (opts.url.endsWith("/api/internal/notifications/failed")) {
        return {
          statusCode: 200,
          data: {
            items: [
              {
                jobId: "j1",
                name: "notify",
                data: { monitorId: "m1" },
                failedReason: "smtp timeout",
                attemptsMade: 3,
                failedAt: 1_700_000_000_000,
              },
            ],
          },
        };
      }
      return { statusCode: 200, data: {} };
    });

    render(<AdminDlqPage />);

    await waitFor(() => {
      expect(screen.getByText(/smtp timeout/)).toBeTruthy();
    });
    expect(screen.getByText("#j1 · notify")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重新投递" })).toBeTruthy();
  });

  it("calls the retry endpoint and reloads on success", async () => {
    const calls: string[] = [];
    taro.request.mockImplementation(async (opts: { url: string }) => {
      calls.push(opts.url);
      if (opts.url.endsWith("/api/internal/notifications/failed")) {
        return {
          statusCode: 200,
          data: {
            items: [
              {
                jobId: "j1",
                name: "notify",
                data: {},
                failedReason: "x",
                attemptsMade: 3,
                failedAt: 1_700_000_000_000,
              },
            ],
          },
        };
      }
      if (opts.url.endsWith("/api/internal/notifications/failed/j1/retry")) {
        return {
          statusCode: 200,
          data: { jobId: "j1", retried: true },
        };
      }
      return { statusCode: 200, data: {} };
    });

    render(<AdminDlqPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重新投递" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "重新投递" }));
    await waitFor(() => {
      expect(
        calls.some((u) =>
          u.endsWith("/api/internal/notifications/failed/j1/retry"),
        ),
      ).toBe(true);
    });
  });

  it("prompts for a token when none is stored", () => {
    taro.getStorageSync.mockImplementation(() => undefined);
    render(<AdminDlqPage />);
    expect(screen.getByPlaceholderText("内部 token")).toBeTruthy();
    expect(screen.getByText(/需要内部 token 才能访问 DLQ/)).toBeTruthy();
  });
});
