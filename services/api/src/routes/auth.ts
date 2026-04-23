import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { type WeChatAuthConfig, exchangeCodeForOpenId } from "../lib/wechat.js";

export interface AuthRouteOptions {
  wechat?: WeChatAuthConfig | null;
}

function newToken() {
  return randomBytes(24).toString("hex");
}

function upsertByOpenId(
  app: FastifyInstance,
  openId: string,
  unionId: string | null,
): { userId: string; token: string; isNew: boolean } {
  const now = new Date().toISOString();
  const existing = app.db
    .prepare("SELECT id, token FROM users WHERE wechat_openid = ?")
    .get(openId) as { id: string; token: string } | undefined;

  if (existing) {
    app.db
      .prepare("UPDATE users SET last_seen_at = ? WHERE id = ?")
      .run(now, existing.id);
    return { userId: existing.id, token: existing.token, isNew: false };
  }

  const id = randomUUID();
  const token = newToken();
  app.db
    .prepare(
      `INSERT INTO users (id, token, wechat_openid, wechat_union_id, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, token, openId, unionId, now, now);
  return { userId: id, token, isNew: true };
}

export function registerAuthRoutes(options: AuthRouteOptions = {}) {
  return async (app: FastifyInstance) => {
    app.post("/api/auth/anonymous", async (_request, reply) => {
      const now = new Date().toISOString();
      const id = randomUUID();
      const token = newToken();
      app.db
        .prepare(
          `INSERT INTO users (id, token, created_at, last_seen_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(id, token, now, now);
      return reply.code(201).send({ userId: id, token });
    });

    app.post<{ Body: { code: string } }>(
      "/api/auth/wechat",
      {
        schema: {
          body: {
            type: "object",
            required: ["code"],
            additionalProperties: false,
            properties: {
              code: { type: "string", minLength: 1, maxLength: 256 },
            },
          },
        },
      },
      async (request, reply) => {
        if (!options.wechat) {
          return reply.code(503).send({
            code: "WECHAT_NOT_CONFIGURED",
            message:
              "WeChat auth is not configured. Set WECHAT_APPID / WECHAT_SECRET on the server.",
          });
        }

        try {
          const { openId, unionId } = await exchangeCodeForOpenId(
            request.body.code,
            options.wechat,
          );
          const { userId, token, isNew } = upsertByOpenId(app, openId, unionId);
          return reply.code(isNew ? 201 : 200).send({ userId, token });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "WeChat auth failed";
          request.log?.warn?.({ err: error }, "wechat auth failed");
          return reply.code(400).send({
            code: "WECHAT_AUTH_FAILED",
            message,
          });
        }
      },
    );
  };
}
