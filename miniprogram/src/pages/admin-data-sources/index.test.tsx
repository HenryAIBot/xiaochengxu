import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminDataSourcesPage from "./index";

const taro = vi.hoisted(() => ({
  request: vi.fn(),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@tarojs/taro", () => ({
  default: taro,
}));

describe("AdminDataSourcesPage", () => {
  beforeEach(() => {
    taro.request.mockReset();
    taro.getStorageSync.mockReset();
    taro.setStorageSync.mockReset();
    taro.getStorageSync.mockImplementation((key: string) =>
      key === "internalToken" ? "dev-internal-secret" : undefined,
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("renders capability rows with provider/capability labels and live badge", async () => {
    taro.request.mockResolvedValue({
      statusCode: 200,
      data: {
        items: [
          {
            provider: "courtlistener",
            capability: "court_search",
            dataSource: "live",
            configured: true,
            requiredEnv: ["COURTLISTENER_API_TOKEN"],
            optionalEnv: ["COURTLISTENER_BASE_URL"],
            missingEnv: [],
          },
          {
            provider: "amazon",
            capability: "listing_lookup",
            dataSource: "fixture",
            configured: false,
            requiredEnv: ["AMAZON_LISTING_URL_TEMPLATE"],
            optionalEnv: ["AMAZON_AUTH_HEADER"],
            missingEnv: ["AMAZON_LISTING_URL_TEMPLATE"],
          },
        ],
      },
    });

    render(<AdminDataSourcesPage />);

    await waitFor(() => {
      expect(
        screen.getByText("CourtListener · 法院记录 · 案件搜索"),
      ).toBeTruthy();
    });
    expect(screen.getByText("真实数据")).toBeTruthy();
    expect(screen.getByText("演示数据")).toBeTruthy();
    expect(
      screen.getByText("缺失 env：AMAZON_LISTING_URL_TEMPLATE"),
    ).toBeTruthy();
  });

  it("shows error state when the request fails", async () => {
    taro.request.mockResolvedValue({ statusCode: 401, data: {} });
    render(<AdminDataSourcesPage />);
    await waitFor(() => {
      expect(screen.getByText("加载失败")).toBeTruthy();
    });
    expect(screen.getByText("HTTP 401")).toBeTruthy();
  });

  it("prompts for a token when none is stored", () => {
    taro.getStorageSync.mockImplementation(() => undefined);
    render(<AdminDataSourcesPage />);
    expect(screen.getByPlaceholderText("内部 token")).toBeTruthy();
    expect(screen.getByText(/需要内部 token 才能访问数据源状态/)).toBeTruthy();
  });
});
