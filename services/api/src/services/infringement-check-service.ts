import { type DetectionSignal, buildPreview } from "@xiaochengxu/core";

interface TrademarkSearchPayload {
  marks: Array<{ owner: string; mark: string; status: string }>;
}

interface InfringementPorts {
  getListingHtml(asin: string): Promise<string>;
  searchMarks(term: string): Promise<TrademarkSearchPayload>;
}

function extractListingBrand(html: string) {
  const brandMatch = html.match(/data-brand="([^"]+)"/i);
  if (brandMatch?.[1]) {
    return brandMatch[1].trim().toLowerCase();
  }

  const titleMatch = html.match(/data-title="([^"]+)"/i);
  return titleMatch?.[1]?.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

export class InfringementCheckService {
  constructor(private readonly ports: InfringementPorts) {}

  async run(asin: string) {
    const html = await this.ports.getListingHtml(asin);
    const brand = extractListingBrand(html);
    const trademarkPayload = await this.ports.searchMarks(brand);
    const evidence: DetectionSignal[] = trademarkPayload.marks.map((mark) => ({
      source: "uspto",
      level: mark.status === "LIVE" ? "suspected_high" : "watch",
      reason: `${mark.mark} owned by ${mark.owner} is ${mark.status}`,
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
