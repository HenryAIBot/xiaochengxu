import type { FastifyRequest } from "fastify";
import type { QueryTaskDatabase } from "./db.js";

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

export function resolveRequestUser(
  db: QueryTaskDatabase,
  request: FastifyRequest,
): RequestUser | null {
  const token = parseBearerToken(request.headers.authorization);
  if (!token) return null;

  const row = db.prepare("SELECT id FROM users WHERE token = ?").get(token) as
    | { id: string }
    | undefined;

  if (!row) return null;

  db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    row.id,
  );

  return { id: row.id };
}
