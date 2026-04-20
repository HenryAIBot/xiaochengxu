import { type DetectionSignal, buildPreview } from "@xiaochengxu/core";
import type { CourtListenerPort } from "../connectors/courtlistener-connector.js";

export interface CaseTimelineItem {
  at: string;
  event: string;
}

export class CaseProgressService {
  constructor(private readonly connector: CourtListenerPort) {}

  async run(caseNumber: string) {
    const docket = await this.connector.getDocket(caseNumber);
    const timeline: CaseTimelineItem[] = docket.entries.map((entry) => ({
      at: entry.date,
      event: entry.description,
    }));
    const evidence: DetectionSignal[] = timeline.map((entry) => ({
      source: "courtlistener",
      level: "watch",
      reason: `${entry.at} ${entry.event}`,
    }));

    return {
      preview: buildPreview({
        tool: "case_progress",
        evidence,
      }),
      timeline,
    };
  }
}
