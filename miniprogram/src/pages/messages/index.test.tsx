import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessagesPage from "./index";

const taro = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock("@tarojs/taro", () => ({
  default: taro,
}));

describe("MessagesPage", () => {
  beforeEach(() => {
    taro.request.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads and renders the message list", async () => {
    taro.request.mockResolvedValue({
      data: [
        {
          id: "m-1",
          channel: "email",
          body: "新的 TRO 命中。",
          monitorId: "mon-1",
          level: "suspected_high",
          toAddress: "seller@example.com",
          createdAt: "2026-04-21T03:15:00.000Z",
        },
      ],
    });

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText("新的 TRO 命中。")).toBeTruthy();
    });
    expect(screen.getByText(/接收：seller@example\.com/)).toBeTruthy();
  });

  it("shows empty state when API returns no messages", async () => {
    taro.request.mockResolvedValue({ data: [] });

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText("暂无新消息")).toBeTruthy();
    });
  });

  it("shows an error with retry when the request fails", async () => {
    taro.request.mockRejectedValueOnce(new Error("network down"));

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText("network down")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });
});
