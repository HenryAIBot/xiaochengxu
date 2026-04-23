import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { QueryTaskDatabase } from "../lib/db.js";

export interface AdvisorRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  active: number;
  created_at: string;
  last_assigned_at: string | null;
}

export function listActiveAdvisors(db: QueryTaskDatabase): AdvisorRow[] {
  return db
    .prepare(
      `SELECT id, name, phone, email, specialty, active, created_at, last_assigned_at
       FROM advisors WHERE active = 1
       ORDER BY COALESCE(last_assigned_at, '') ASC, created_at ASC`,
    )
    .all() as AdvisorRow[];
}

/**
 * Pick the next advisor using least-recently-assigned ordering (simple
 * round-robin). Returns null when no active advisor exists.
 */
export function pickNextAdvisor(db: QueryTaskDatabase): AdvisorRow | null {
  const advisors = listActiveAdvisors(db);
  return advisors[0] ?? null;
}

export function markAdvisorAssigned(
  db: QueryTaskDatabase,
  advisorId: string,
  at: string,
) {
  db.prepare("UPDATE advisors SET last_assigned_at = ? WHERE id = ?").run(
    at,
    advisorId,
  );
}

/**
 * Seed a couple of advisors when the table is empty. Runs once at app boot
 * so a fresh dev DB has at least one assignable advisor; production can
 * replace these via POST /api/internal/advisors.
 */
export function seedDefaultAdvisors(db: QueryTaskDatabase) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM advisors").get() as {
    n: number;
  };
  if (existing.n > 0) return;
  const now = new Date().toISOString();
  const rows: Array<Omit<AdvisorRow, "active" | "last_assigned_at">> = [
    {
      id: randomUUID(),
      name: "陈顾问",
      phone: "+8613800000001",
      email: "chen@advisor.example",
      specialty: "侵权应诉 / TRO 冻结",
      created_at: now,
    },
    {
      id: randomUUID(),
      name: "林顾问",
      phone: "+8613800000002",
      email: "lin@advisor.example",
      specialty: "商标授权 / 品牌备案",
      created_at: now,
    },
  ];
  const insert = db.prepare(
    `INSERT INTO advisors (id, name, phone, email, specialty, active, created_at)
     VALUES (@id, @name, @phone, @email, @specialty, 1, @created_at)`,
  );
  for (const row of rows) insert.run(row);
}

export async function registerAdvisorRoutes(app: FastifyInstance) {
  app.get("/api/advisors", async () => {
    const items = listActiveAdvisors(app.db).map((row) => ({
      id: row.id,
      name: row.name,
      specialty: row.specialty,
      // Phone/email intentionally omitted — frontend contacts via consultation only.
    }));
    return { items };
  });

  app.post<{
    Body: {
      name: string;
      phone?: string;
      email?: string;
      specialty?: string;
    };
  }>(
    "/api/internal/advisors",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 60 },
            phone: { type: "string", maxLength: 30 },
            email: { type: "string", format: "email" },
            specialty: { type: "string", maxLength: 120 },
          },
        },
      },
    },
    async (request, reply) => {
      const expected = app.internalToken;
      if (expected !== null && expected !== "") {
        const provided = request.headers["x-internal-token"];
        if (provided !== expected) {
          return reply.code(401).send({ error: "unauthorized" });
        }
      }
      const row = {
        id: randomUUID(),
        name: request.body.name,
        phone: request.body.phone ?? null,
        email: request.body.email ?? null,
        specialty: request.body.specialty ?? null,
        created_at: new Date().toISOString(),
      };
      app.db
        .prepare(
          `INSERT INTO advisors (id, name, phone, email, specialty, active, created_at)
           VALUES (@id, @name, @phone, @email, @specialty, 1, @created_at)`,
        )
        .run(row);
      return reply.code(201).send({
        id: row.id,
        name: row.name,
        specialty: row.specialty,
      });
    },
  );
}
