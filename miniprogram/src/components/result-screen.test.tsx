import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultScreen } from "./result-screen";

const evidence = [
  {
    id: "evidence-1",
    title: "USPTO 商标命中",
    source: "美国商标库",
    matchedField: "风险信号",
    description: "品牌词与注册商标近似。",
  },
  {
    id: "evidence-2",
    title: "法院新案信号",
    source: "美国法院记录",
    matchedField: "风险信号",
    description: "相关品牌近期出现联邦法院案件。",
  },
];

describe("ResultScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows risk triage content before asking users to unlock the full report", () => {
    render(
      <ResultScreen
        toolName="侵权体检"
        level="疑似高风险"
        summary="检测到新案与商标风险信号。"
        updatedAt="2026-04-21 10:30"
        evidence={evidence}
        actions={["立即复核商品页", "加入持续监控"]}
        onUnlockReport={vi.fn()}
        onStartMonitor={vi.fn()}
        onContactAdvisor={vi.fn()}
      />,
    );

    expect(screen.getByText("侵权体检结果")).toBeTruthy();
    expect(screen.getByText("疑似高风险")).toBeTruthy();
    expect(screen.getByText("检测到新案与商标风险信号。")).toBeTruthy();
    expect(screen.getByText("更新于 2026-04-21 10:30")).toBeTruthy();
    expect(screen.getByText("关键证据")).toBeTruthy();
    expect(screen.getByText("USPTO 商标命中")).toBeTruthy();
    expect(
      screen.getByText("来源：美国商标库 · 命中字段：风险信号"),
    ).toBeTruthy();
    expect(screen.getByText("建议动作")).toBeTruthy();
    expect(screen.getByText("立即复核商品页")).toBeTruthy();
    expect(screen.getAllByText("解锁完整报告").length).toBeGreaterThan(0);
  });

  it("triggers unlock, monitor, and advisor calls to action", () => {
    const onUnlockReport = vi.fn();
    const onStartMonitor = vi.fn();
    const onContactAdvisor = vi.fn();

    render(
      <ResultScreen
        toolName="TRO 预警"
        level="需关注"
        summary="近期发现相关案件变化。"
        updatedAt="2026-04-21 10:30"
        evidence={evidence}
        actions={["继续观察"]}
        onUnlockReport={onUnlockReport}
        onStartMonitor={onStartMonitor}
        onContactAdvisor={onContactAdvisor}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "解锁完整报告" }));
    // First "加入监控" tap opens the interval picker; second confirm
    // fires the callback with the chosen tickIntervalSeconds.
    fireEvent.click(screen.getByRole("button", { name: "加入监控" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入监控" }));
    fireEvent.click(screen.getByRole("button", { name: "联系顾问" }));

    expect(onUnlockReport).toHaveBeenCalledTimes(1);
    expect(onStartMonitor).toHaveBeenCalledTimes(1);
    expect(onStartMonitor).toHaveBeenCalledWith({ tickIntervalSeconds: 900 });
    expect(onContactAdvisor).toHaveBeenCalledTimes(1);
  });

  it("shows an empty evidence state when no evidence can be previewed", () => {
    render(
      <ResultScreen
        toolName="案件进展"
        level="clear"
        summary="暂未发现新的案件进展。"
        updatedAt="2026-04-21 10:30"
        evidence={[]}
        actions={["继续观察"]}
        onUnlockReport={vi.fn()}
        onStartMonitor={vi.fn()}
        onContactAdvisor={vi.fn()}
      />,
    );

    expect(screen.getByText("暂未发现可展示的关键证据")).toBeTruthy();
  });
});
