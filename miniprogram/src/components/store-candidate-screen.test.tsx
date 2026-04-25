import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoreCandidateScreen } from "./store-candidate-screen";

const items = [
  {
    asin: "B0DPHRHRDL",
    title: "Nike Men's Revolution 8 Road Running Shoes",
  },
];

describe("StoreCandidateScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Rainforest live-data badge for live storefront candidates", () => {
    render(
      <StoreCandidateScreen
        items={items}
        dataSource="live"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("真实商品数据（Rainforest API）")).toBeTruthy();
    expect(
      screen.getByText("Nike Men's Revolution 8 Road Running Shoes"),
    ).toBeTruthy();
  });

  it("shows fixture badge for demo storefront candidates", () => {
    render(
      <StoreCandidateScreen
        items={items}
        dataSource="fixture"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("演示数据（非真实 API）")).toBeTruthy();
  });
});
