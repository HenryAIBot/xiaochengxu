import { type DetectionSignal, buildPreview } from "@xiaochengxu/core";
import type { InputKind } from "@xiaochengxu/core";

interface TrademarkSearchPayload {
  marks: Array<{ owner: string; mark: string; status: string; url?: string }>;
}

interface InfringementPorts {
  getListingHtml(asin: string): Promise<string>;
  searchMarks(term: string): Promise<TrademarkSearchPayload>;
}

function extractListingBrand(html: string) {
  // 优先从 Brand: xxx 格式提取
  const bylineMatch = html.match(/Brand:\s*([^<\n]+)/i);
  if (bylineMatch?.[1]) {
    return bylineMatch[1].trim().toLowerCase();
  }

  const brandMatch = html.match(/data-brand="([^"]+)"/i);
  if (brandMatch?.[1]) {
    return brandMatch[1].trim().toLowerCase();
  }

  const titleMatch =
    html.match(/id="productTitle"[^>]*>([^<]+)/i) ??
    html.match(/data-title="([^"]+)"/i);
  return titleMatch?.[1]?.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function formatTrademarkReason(owner: string, status: string, marks: string[]) {
  if (marks.length === 1) {
    const statusLabel = status === "LIVE" ? "有效" : "失效";
    return `商标 ${marks[0]}（权利人：${owner}）当前状态为${statusLabel}`;
  }

  const statusLabel = status === "LIVE" ? "有效商标" : "失效商标";
  return `权利人 ${owner} 名下${statusLabel}：${marks.join("、")}`;
}

function toTrademarkEvidence(
  marks: TrademarkSearchPayload["marks"],
): DetectionSignal[] {
  const groupedMarks = new Map<
    string,
    { owner: string; status: string; marks: string[]; url?: string }
  >();

  for (const mark of marks) {
    const key = `${mark.owner}\u0000${mark.status}`;
    const existing = groupedMarks.get(key);

    if (existing) {
      if (!existing.marks.includes(mark.mark)) {
        existing.marks.push(mark.mark);
      }
      if (!existing.url && mark.url) existing.url = mark.url;
      continue;
    }

    groupedMarks.set(key, {
      owner: mark.owner,
      status: mark.status,
      marks: [mark.mark],
      url: mark.url,
    });
  }

  return Array.from(groupedMarks.values()).map((group) => ({
    source: "uspto",
    level: group.status === "LIVE" ? "suspected_high" : "watch",
    reason: formatTrademarkReason(group.owner, group.status, group.marks),
    originalUrl: group.url,
  }));
}

function formatSingleTrademarkReason(
  mark: TrademarkSearchPayload["marks"][number],
) {
  const statusLabel = mark.status === "LIVE" ? "有效" : "失效";
  return `商标 ${mark.mark}（权利人：${mark.owner}）当前状态为${statusLabel}`;
}

export class InfringementCheckService {
  constructor(private readonly ports: InfringementPorts) {}

  async run(input: string, inputKind: InputKind = "asin") {
    if (inputKind !== "asin") {
      const trademarkPayload = await this.ports.searchMarks(input);
      const evidence = toTrademarkEvidence(trademarkPayload.marks);

      return {
        preview: buildPreview({
          tool: "infringement_check",
          evidence,
        }),
        listing: {
          asin: null,
          brand: input,
          inputKind,
        },
      };
    }

    const asin = input;
    const html = await this.ports.getListingHtml(asin);
    const brand = extractListingBrand(html);
    const trademarkPayload = await this.ports.searchMarks(brand);
    const evidence: DetectionSignal[] = trademarkPayload.marks.map((mark) => ({
      source: "uspto",
      level: mark.status === "LIVE" ? "suspected_high" : "watch",
      reason: formatSingleTrademarkReason(mark),
      originalUrl: mark.url,
    }));

    return {
      preview: buildPreview({
        tool: "infringement_check",
        evidence,
      }),
      listing: {
        asin,
        brand,
      },
    };
  }
}
