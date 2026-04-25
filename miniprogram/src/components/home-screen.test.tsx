import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./home-screen";

describe("HomeScreen", () => {
  afterEach(() => {
    cleanup();
  });

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

  it("disables submit and tool switching while submission is in flight", async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<HomeScreen onSubmit={onSubmit} />);

    fireEvent.change(
      screen.getByPlaceholderText("品牌词 / 店铺名 / ASIN / 案件号"),
      { target: { value: "nike" } },
    );
    fireEvent.click(screen.getByText("立即检测"));

    expect(
      (screen.getByRole("button", { name: "检测中…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "TRO 预警" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    resolveSubmit?.();

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "立即检测" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  });
});
