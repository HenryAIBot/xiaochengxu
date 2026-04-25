import { type DetectionSignal, buildPreview } from "@xiaochengxu/core";
import type { CourtListenerPort } from "../connectors/courtlistener-connector.js";

export class TroAlertService {
  constructor(private readonly connector: CourtListenerPort) {}

  async run(target: string) {
    const payload = await this.connector.search(target);
    const signals: DetectionSignal[] = payload.results.map((result) => {
      const hasTro = result.snippet
        .toLowerCase()
        .includes("temporary restraining order");

      return {
        source: "courtlistener",
        level: hasTro ? "suspected_high" : "watch",
        reason: hasTro
          ? `发现相关临时限制令案件：${result.caseName}`
          : `发现相关法院案件：${result.caseName}`,
        originalUrl: result.url,
      };
    });

    return {
      preview: buildPreview({
        tool: "tro_alert",
        evidence: signals,
      }),
    };
  }
}
