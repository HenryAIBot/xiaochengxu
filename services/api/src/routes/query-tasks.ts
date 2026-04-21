import { randomUUID } from "node:crypto";
import {
  BlankInputError,
  type NormalizedInput,
  type ToolName,
  normalizeInput,
} from "@xiaochengxu/core";
import type { FastifyInstance } from "fastify";
import { RealAmazonListingConnector } from "../connectors/real-amazon-listing-connector.js";
import { RealCourtListenerConnector } from "../connectors/real-courtlistener-connector.js";
import { RealUsptoTrademarkConnector } from "../connectors/real-uspto-trademark-connector.js";
import { QueryTaskRepository } from "../repositories/query-task-repository.js";
import { CaseProgressService } from "../services/case-progress-service.js";
import { InfringementCheckService } from "../services/infringement-check-service.js";
import { TroAlertService } from "../services/tro-alert-service.js";

interface QueryTaskBody {
  tool: ToolName;
  input: string;
}

const TOOL_NAMES = new Set<ToolName>([
  "infringement_check",
  "tro_alert",
  "case_progress",
]);

function isQueryTaskBody(body: unknown): body is QueryTaskBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.tool === "string" &&
    TOOL_NAMES.has(candidate.tool as ToolName) &&
    typeof candidate.input === "string"
  );
}

const courtListener = new RealCourtListenerConnector();
const amazonConnector = new RealAmazonListingConnector();
const usptoConnector = new RealUsptoTrademarkConnector();

const troAlertService = new TroAlertService(courtListener);
const infringementCheckService = new InfringementCheckService({
  getListingHtml: (asin: string) => amazonConnector.getListingHtml(asin),
  searchMarks: (term: string) => usptoConnector.searchMarks(term),
});
const caseProgressService = new CaseProgressService(courtListener);

const RISK_LABELS: Record<string, string> = {
  clear: "安全",
  watch: "需关注",
  suspected_high: "疑似高风险",
  confirmed: "已确认",
};

export async function registerQueryTaskRoutes(app: FastifyInstance) {
  app.post("/api/query-tasks", async (request, reply) => {
    if (!isQueryTaskBody(request.body)) {
      return reply.code(400).send({
        code: "INVALID_REQUEST",
        message: "请求内容必须包含检测工具和输入内容",
      });
    }

    const repository = new QueryTaskRepository(app.db);
    let normalizedInput: NormalizedInput;

    try {
      normalizedInput = normalizeInput(request.body.input);
    } catch (error) {
      if (error instanceof BlankInputError) {
        return reply.code(400).send({
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }

    const task = repository.create({
      tool: request.body.tool,
      rawInput: request.body.input,
      normalizedInput,
    });

    const reportId = randomUUID();
    let result: {
      level: string;
      summary: string;
      evidence: unknown[];
      recommendedActions: string[];
      extra?: unknown;
    };

    switch (request.body.tool) {
      case "tro_alert": {
        const troResult = await troAlertService.run(
          normalizedInput.normalizedValue,
        );
        result = {
          level: troResult.preview.level,
          summary: troResult.preview.summary,
          evidence: troResult.preview.evidence,
          recommendedActions: troResult.preview.recommendedActions,
        };
        break;
      }
      case "infringement_check": {
        const infrResult = await infringementCheckService.run(
          normalizedInput.normalizedValue,
          normalizedInput.kind,
        );
        result = {
          level: infrResult.preview.level,
          summary: infrResult.preview.summary,
          evidence: infrResult.preview.evidence,
          recommendedActions: infrResult.preview.recommendedActions,
          extra: infrResult.listing,
        };
        break;
      }
      case "case_progress": {
        const caseResult = await caseProgressService.run(
          normalizedInput.normalizedValue,
        );
        result = {
          level: caseResult.preview.level,
          summary: caseResult.preview.summary,
          evidence: caseResult.preview.evidence,
          recommendedActions: caseResult.preview.recommendedActions,
          extra: { timeline: caseResult.timeline },
        };
        break;
      }
      default:
        result = {
          level: "clear",
          summary: "未知检测类型",
          evidence: [],
          recommendedActions: [],
        };
    }

    app.db
      .prepare(
        `INSERT INTO reports (
          id, task_id, level, summary, evidence_json, recommended_actions_json, extra_json, unlocked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        reportId,
        task.id,
        result.level,
        result.summary,
        JSON.stringify(result.evidence),
        JSON.stringify(result.recommendedActions),
        result.extra ? JSON.stringify(result.extra) : null,
      );

    repository.updateStatus(task.id, "completed");

    return reply.code(200).send({
      id: task.id,
      reportId,
      status: "completed",
      normalizedInput,
      level: result.level,
      levelLabel: RISK_LABELS[result.level] ?? result.level,
      summary: result.summary,
      evidence: result.evidence,
      recommendedActions: result.recommendedActions,
      extra: result.extra ?? null,
    });
  });

  app.get("/api/query-tasks/:taskId", async (request) => {
    const { taskId } = request.params as { taskId: string };
    const row = app.db
      .prepare("SELECT * FROM query_tasks WHERE id = ?")
      .get(taskId);
    if (!row) {
      return { found: false };
    }
    const report = app.db
      .prepare("SELECT * FROM reports WHERE task_id = ?")
      .get(taskId);
    return { found: true, task: row, report };
  });
}
