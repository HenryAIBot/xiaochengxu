import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MessageItem } from "../lib/api";
import { MessageListScreen } from "./message-list-screen";

describe("MessageListScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an empty state when no messages exist", () => {
    render(<MessageListScreen messages={[]} />);
    expect(screen.getByText("暂无新消息")).toBeTruthy();
  });

  it("renders channel, level, time, body and recipient for each message", () => {
    const messages: MessageItem[] = [
      {
        id: "m-1",
        channel: "email",
        body: "发现 Nike 品牌 TRO 信号。",
        monitorId: "mon-1",
        level: "suspected_high",
        toAddress: "seller@example.com",
        createdAt: "2026-04-21T03:15:00.000Z",
      },
      {
        id: "m-2",
        channel: "sms",
        body: "收到新的监控命中。",
        monitorId: "mon-1",
        level: "watch",
        toAddress: "+8613800138000",
        createdAt: "2026-04-21T03:10:00.000Z",
      },
    ];

    render(<MessageListScreen messages={messages} />);

    expect(screen.getByText("邮件")).toBeTruthy();
    expect(screen.getByText("短信")).toBeTruthy();
    expect(screen.getByText("发现 Nike 品牌 TRO 信号。")).toBeTruthy();
    expect(screen.getByText("收到新的监控命中。")).toBeTruthy();
    expect(screen.getByText("接收：seller@example.com")).toBeTruthy();
    expect(screen.getByText("接收：+8613800138000")).toBeTruthy();
  });

  it("handles missing level and recipient gracefully", () => {
    const messages: MessageItem[] = [
      {
        id: "m-3",
        channel: "system",
        body: "监控命中但未配置通知渠道。",
        monitorId: "mon-2",
        level: null,
        toAddress: null,
        createdAt: "2026-04-21T03:00:00.000Z",
      },
    ];

    render(<MessageListScreen messages={messages} />);
    expect(screen.getByText("系统")).toBeTruthy();
    expect(screen.getByText("接收：—")).toBeTruthy();
  });
});
