import { type DetectionSignal, buildPreview } from "@xiaochengxu/core";
import type { CourtListenerPort } from "../connectors/courtlistener-connector.js";

export interface CaseTimelineItem {
  at: string;
  event: string;
}

const CASE_EVENT_TRANSLATIONS: Array<[RegExp, string]> = [
  [/temporary restraining order entered/i, "法院已签发临时限制令"],
  [/motion for temporary restraining order/i, "原告已提交临时限制令申请"],
  [/preliminary injunction/i, "出现初步禁令相关节点"],
  [/complaint filed/i, "原告已提交起诉状"],
  [/case assigned to judge/i, "案件已分配法官"],
  [/summons issued/i, "法院已发出传票"],
  [/affidavit/i, "原告已提交宣誓材料"],
  [/trademark infringement/i, "出现商标侵权相关主张"],
  [/counterfeit/i, "出现假冒商品相关主张"],
];

function translateCaseEvent(description: string) {
  const matched = CASE_EVENT_TRANSLATIONS.find(([pattern]) =>
    pattern.test(description),
  );

  return matched?.[1] ?? description;
}

export class CaseProgressService {
  constructor(private readonly connector: CourtListenerPort) {}

  async run(caseNumber: string) {
    const docket = await this.connector.getDocket(caseNumber);
    const timeline: CaseTimelineItem[] = docket.entries.map((entry) => ({
      at: entry.date,
      event: translateCaseEvent(entry.description),
    }));
    const evidence: DetectionSignal[] = timeline.map((entry) => ({
      source: "courtlistener",
      level: "watch",
      reason: `${entry.at} 出现新的案件节点：${entry.event}`,
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
