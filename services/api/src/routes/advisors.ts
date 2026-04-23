import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { DatabaseAdapter } from "../lib/db-adapter.js";

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

export async function listActiveAdvisors(
  db: DatabaseAdapter,
): Promise<AdvisorRow[]> {
  // NULLs-first ordering: advisors who've never been assigned go first.
  // Both sqlite and postgres support "ORDER BY col ASC NULLS FIRST".
  return db
    .prepare(
      `SELECT id, name, phone, email, specialty, active, created_at, last_assigned_at
       FROM advisors WHERE active
       ORDER BY last_assigned_at ASC NULLS FIRST, created_at ASC`,
    )
    .all<AdvisorRow>();
}

export async function pickNextAdvisor(
  db: DatabaseAdapter,
): Promise<AdvisorRow | null> {
  const advisors = await listActiveAdvisors(db);
  return advisors[0] ?? null;
}

export async function markAdvisorAssigned(
  db: DatabaseAdapter,
  advisorId: string,
  at: string,
): Promise<void> {
  await db
    .prepare("UPDATE advisors SET last_assigned_at = ? WHERE id = ?")
    .run(at, advisorId);
}

export async function seedDefaultAdvisors(db: DatabaseAdapter): Promise<void> {
  const existing = await db
    .prepare("SELECT COUNT(*) AS n FROM advisors")
    .get<{ n: number }>();
  if (!existing || existing.n > 0) return;
  const now = new Date().toISOString();
  const activeFlag = db.dialect === "postgres" ? true : 1;
  const rows = [
    {
      id: randomUUID(),
      name: "陈顾问",
      phone: "+8613800000001",
      email: "chen@advisor.example",
      specialty: "侵权应诉 / TRO 冻结",
      active: activeFlag,
      created_at: now,
    },
    {
      id: randomUUID(),
      name: "林顾问",
      phone: "+8613800000002",
      email: "lin@advisor.example",
      specialty: "商标授权 / 品牌备案",
      active: activeFlag,
      created_at: now,
    },
  ];
  const insert = db.prepare(
    `INSERT INTO advisors (id, name, phone, email, specialty, active, created_at)
     VALUES (@id, @name, @phone, @email, @specialty, @active, @created_at)`,
  );
  for (const row of rows) await insert.run(row);
}

export async function registerAdvisorRoutes(app: FastifyInstance) {
  app.get("/api/advisors", async () => {
    const items = (await listActiveAdvisors(app.db)).map((row) => ({
      id: row.id,
      name: row.name,
      specialty: row.specialty,
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
        active: app.db.dialect === "postgres" ? true : 1,
        created_at: new Date().toISOString(),
      };
      await app.db
        .prepare(
          `INSERT INTO advisors (id, name, phone, email, specialty, active, created_at)
           VALUES (@id, @name, @phone, @email, @specialty, @active, @created_at)`,
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
