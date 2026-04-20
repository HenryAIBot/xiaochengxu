import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportUnlockScreen } from "./report-unlock-screen";

describe("ReportUnlockScreen", () => {
  it("submits the lead contact to unlock the full report", () => {
    const onUnlock = vi.fn();

    render(<ReportUnlockScreen onUnlock={onUnlock} />);

    fireEvent.click(screen.getByText("邮箱解锁"));

    expect(onUnlock).toHaveBeenCalledWith({ email: "seller@example.com" });
  });
});
