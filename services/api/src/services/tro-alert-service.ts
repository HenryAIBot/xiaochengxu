import { type DetectionSignal, buildPreview } from "@xiaochengxu/core";
import type { CourtListenerPort } from "../connectors/courtlistener-connector.js";

export class TroAlertService {
  constructor(private readonly connector: CourtListenerPort) {}

  async run(target: string) {
    const payload = await this.connector.search(target);
    const signals: DetectionSignal[] = payload.results.map((result) => ({
      source: "courtlistener",
      level: result.snippet
        .toLowerCase()
        .includes("temporary restraining order")
        ? "suspected_high"
        : "watch",
      reason: `${result.caseName}: ${result.snippet}`,
    }));

    return {
      preview: buildPreview({
        tool: "tro_alert",
        evidence: signals,
      }),
    };
  }
}
