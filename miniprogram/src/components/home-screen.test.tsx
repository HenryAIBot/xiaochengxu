import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./home-screen";

describe("HomeScreen", () => {
  it("submits the selected tool and input value", () => {
    const onSubmit = vi.fn();

    render(<HomeScreen onSubmit={onSubmit} />);

    fireEvent.change(
      screen.getByPlaceholderText("品牌词 / 店铺名 / ASIN / 案件号"),
      { target: { value: "nike" } },
    );
    fireEvent.click(screen.getByText("TRO 预警"));
    fireEvent.click(screen.getByText("立即检测"));

    expect(onSubmit).toHaveBeenCalledWith({
      tool: "tro_alert",
      input: "nike",
    });
  });
});
