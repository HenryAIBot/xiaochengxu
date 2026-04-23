import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifySchema } from "fastify";
import { markAdvisorAssigned, pickNextAdvisor } from "./advisors.js";

const TARGET_REF_KINDS = [
  "brand",
  "store",
  "asin",
  "amazon_url",
  "case_number",
] as const;
type TargetRefKind = (typeof TARGET_REF_KINDS)[number];

interface CreateConsultationBody {
  name: string;
  phone: string;
  note?: string;
  targetRef?: { kind: TargetRefKind; value: string };
  sourceReportId?: string;
  sourceQueryTaskId?: string;
}

interface PatchConsultationBody {
  status?: "pending" | "assigned" | "in_progress" | "closed";
  note?: string;
}

const createConsultationSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["name", "phone"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 60 },
      phone: { type: "string", pattern: "^\\+?\\d{7,15}$" },
      note: { type: "string", maxLength: 1000 },
      targetRef: {
        type: "object",
        required: ["kind", "value"],
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: [...TARGET_REF_KINDS] },
          value: { type: "string", minLength: 1, maxLength: 200 },
        },
      },
      sourceReportId: { type: "string", minLength: 1, maxLength: 64 },
      sourceQueryTaskId: { type: "string", minLength: 1, maxLength: 64 },
    },
  },
};

const patchConsultationSchema: FastifySchema = {
  body: {
    type: "object",
    minProperties: 1,
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["pending", "assigned", "in_progress", "closed"],
      },
      note: { type: "string", maxLength: 1000 },
    },
  },
};

interface ConsultationRow {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  status: string;
  advisor: string | null;
  advisor_id: string | null;
  advisor_specialty: string | null;
  target_ref_kind: string | null;
  target_ref_value: string | null;
  source_report_id: string | null;
  source_query_task_id: string | null;
  created_at: string;
  updated_at: string | null;
}

function hydrate(row: ConsultationRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    note: row.note,
    status: row.status,
    advisor: row.advisor,
    advisorId: row.advisor_id,
    advisorSpecialty: row.advisor_specialty,
    targetRef:
      row.target_ref_kind && row.target_ref_value
        ? { kind: row.target_ref_kind, value: row.target_ref_value }
        : null,
    sourceReportId: row.source_report_id,
    sourceQueryTaskId: row.source_query_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function registerConsultationRoutes(app: FastifyInstance) {
  app.post(
    "/api/consultations",
    { schema: createConsultationSchema },
    async (request, reply) => {
      const body = request.body as CreateConsultationBody;
      const now = new Date().toISOString();
      const advisor = pickNextAdvisor(app.db);
      const record = {
        id: randomUUID(),
        userId: request.user?.id ?? null,
        name: body.name,
        phone: body.phone,
        note: body.note ?? null,
        status: advisor ? "assigned" : "pending",
        advisor: advisor?.name ?? null,
        advisorId: advisor?.id ?? null,
        targetRefKind: body.targetRef?.kind ?? null,
        targetRefValue: body.targetRef?.value ?? null,
        sourceReportId: body.sourceReportId ?? null,
        sourceQueryTaskId: body.sourceQueryTaskId ?? null,
        createdAt: now,
      };

      app.db
        .prepare(
          `INSERT INTO consultations (
             id, user_id, name, phone, note, status, advisor, advisor_id,
             target_ref_kind, target_ref_value, source_report_id,
             source_query_task_id, created_at, updated_at
           ) VALUES (
             @id, @userId, @name, @phone, @note, @status, @advisor, @advisorId,
             @targetRefKind, @targetRefValue, @sourceReportId,
             @sourceQueryTaskId, @createdAt, @createdAt
           )`,
        )
        .run(record);

      if (advisor) markAdvisorAssigned(app.db, advisor.id, now);

      return reply.code(201).send({
        id: record.id,
        name: record.name,
        phone: record.phone,
        note: record.note,
        status: record.status,
        advisor: record.advisor,
        advisorId: record.advisorId,
        advisorSpecialty: advisor?.specialty ?? null,
        targetRef: body.targetRef ?? null,
        sourceReportId: record.sourceReportId,
        sourceQueryTaskId: record.sourceQueryTaskId,
        createdAt: record.createdAt,
      });
    },
  );

  app.get("/api/consultations", async (request) => {
    const userId = request.user?.id ?? null;
    const whereClause = userId === null ? "c.user_id IS NULL" : "c.user_id = ?";
    const params = userId === null ? [] : [userId];
    const items = (
      app.db
        .prepare(
          `SELECT c.id, c.name, c.phone, c.note, c.status, c.advisor,
                c.advisor_id, c.target_ref_kind, c.target_ref_value,
                c.source_report_id, c.source_query_task_id,
                c.created_at, c.updated_at,
                a.specialty AS advisor_specialty
         FROM consultations c
         LEFT JOIN advisors a ON a.id = c.advisor_id
         WHERE ${whereClause}
         ORDER BY c.created_at DESC`,
        )
        .all(...params) as ConsultationRow[]
    ).map(hydrate);
    return { items };
  });

  app.patch<{ Params: { id: string }; Body: PatchConsultationBody }>(
    "/api/consultations/:id",
    { schema: patchConsultationSchema },
    async (request, reply) => {
      const userId = request.user?.id ?? null;
      const whereUser = userId === null ? "user_id IS NULL" : "user_id = ?";
      const params = userId === null ? [] : [userId];
      const row = app.db
        .prepare(`SELECT id FROM consultations WHERE id = ? AND ${whereUser}`)
        .get(request.params.id, ...params) as { id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not_found" });

      const now = new Date().toISOString();
      const sets: string[] = ["updated_at = ?"];
      const values: unknown[] = [now];
      if (request.body.status) {
        sets.push("status = ?");
        values.push(request.body.status);
      }
      if (request.body.note !== undefined) {
        sets.push("note = ?");
        values.push(request.body.note);
      }
      values.push(request.params.id);
      app.db
        .prepare(`UPDATE consultations SET ${sets.join(", ")} WHERE id = ?`)
        .run(...values);

      const updated = app.db
        .prepare(
          `SELECT c.id, c.name, c.phone, c.note, c.status, c.advisor,
                  c.advisor_id, c.target_ref_kind, c.target_ref_value,
                  c.source_report_id, c.source_query_task_id,
                  c.created_at, c.updated_at,
                  a.specialty AS advisor_specialty
           FROM consultations c
           LEFT JOIN advisors a ON a.id = c.advisor_id
           WHERE c.id = ?`,
        )
        .get(request.params.id) as ConsultationRow;
      return reply.send(hydrate(updated));
    },
  );
}
