import type { FastifyRequest } from "fastify";
import type { DatabaseAdapter } from "./db-adapter.js";

export interface RequestUser {
  id: string;
}

function parseBearerToken(
  header: string | string[] | undefined,
): string | null {
  if (!header) return null;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function resolveRequestUser(
  db: DatabaseAdapter,
  request: FastifyRequest,
): Promise<RequestUser | null> {
  const token = parseBearerToken(request.headers.authorization);
  if (!token) return null;

  const row = await db
    .prepare("SELECT id FROM users WHERE token = ?")
    .get<{ id: string }>(token);

  if (!row) return null;

  await db
    .prepare("UPDATE users SET last_seen_at = ? WHERE id = ?")
    .run(new Date().toISOString(), row.id);

  return { id: row.id };
}
