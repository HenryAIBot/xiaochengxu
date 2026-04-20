import {
  BlankInputError,
  type DetectionSignal,
  buildPreview,
  normalizeInput,
  summarizeRisk,
} from "@xiaochengxu/core";
import { describe, expect, it } from "vitest";

describe("core domain", () => {
  it("rejects blank and whitespace input with a stable code", () => {
    try {
      normalizeInput("");
      throw new Error("expected blank input to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(BlankInputError);
      expect((error as BlankInputError).code).toBe("BLANK_INPUT");
    }

    try {
      normalizeInput("   ");
      throw new Error("expected blank input to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(BlankInputError);
      expect((error as BlankInputError).code).toBe("BLANK_INPUT");
    }
  });

  it("normalizes exact ASIN tokens and Amazon urls into ASIN input", () => {
    const tokenResult = normalizeInput("B0C1234567");
    expect(tokenResult.kind).toBe("asin");
    expect(tokenResult.normalizedValue).toBe("B0C1234567");

    const result = normalizeInput("https://www.amazon.com/dp/B0C1234567");
    expect(result.kind).toBe("asin");
    expect(result.normalizedValue).toBe("B0C1234567");
  });

  it("rejects fake Amazon domains", () => {
    const result = normalizeInput("https://amazon.evil.com/dp/B0C1234567");
    expect(result.kind).toBe("brand");
  });

  it("does not classify arbitrary text containing an asin-like substring as asin", () => {
    const result = normalizeInput("listing copy with B0C1234567 inside");
    expect(result.kind).toBe("brand");
    expect(result.normalizedValue).toBe("listing copy with b0c1234567 inside");
  });

  it("classifies brand, store_name, and case_number inputs", () => {
    expect(normalizeInput("Example Brand").kind).toBe("brand");
    expect(normalizeInput("Example Store").kind).toBe("store_name");
    expect(normalizeInput("12:34-ab-123456").kind).toBe("case_number");
  });

  it("promotes the highest signal into a risk level, headline, and actions", () => {
    const signals: DetectionSignal[] = [
      {
        source: "courtlistener",
        level: "watch",
        reason: "brand name matched a new complaint",
      },
      {
        source: "uspto",
        level: "suspected_high",
        reason: "registered mark overlaps listing brand",
      },
    ];

    const summary = summarizeRisk("infringement_check", signals);
    expect(summary.level).toBe("suspected_high");
    expect(summary.headline).toBe("registered mark overlaps listing brand");
    expect(summary.recommendedActions).toContain(
      "立即复核 Listing 品牌词与图片",
    );
  });

  it("uses empty-signal defaults for summarizeRisk and buildPreview", () => {
    const summary = summarizeRisk("case_progress", []);
    expect(summary.level).toBe("clear");
    expect(summary.headline).toBe("未发现明显风险");
    expect(summary.recommendedActions).toEqual(["继续观察"]);

    const preview = buildPreview({
      tool: "case_progress",
      evidence: [],
    });

    expect(preview.summary).toBe("暂无命中记录");
    expect(preview.evidence).toEqual([]);
    expect(preview.recommendedActions).toEqual(["继续观察"]);
  });

  it("builds a preview from evidence even when caller level and actions are stale", () => {
    const signals: DetectionSignal[] = [
      {
        source: "courtlistener",
        level: "watch",
        reason: "brand name matched a new complaint",
      },
      {
        source: "news",
        level: "clear",
        reason: "no new litigation in the last 30 days",
      },
      {
        source: "social",
        level: "watch",
        reason: "discussion spike on brand claims",
      },
      {
        source: "uspto",
        level: "suspected_high",
        reason: "registered mark overlaps listing brand",
      },
    ];

    const preview = buildPreview({
      tool: "tro_alert",
      evidence: signals,
    });

    expect(preview.level).toBe("suspected_high");
    expect(preview.summary).toBe("registered mark overlaps listing brand");
    expect(preview.recommendedActions).toContain(
      "立即复核 Listing 品牌词与图片",
    );
    expect(preview.evidence).toHaveLength(3);
    expect(preview.evidence[0]?.reason).toBe(
      "registered mark overlaps listing brand",
    );
    expect(
      preview.evidence.some(
        (signal) => signal.reason === "registered mark overlaps listing brand",
      ),
    ).toBe(true);
  });
});
