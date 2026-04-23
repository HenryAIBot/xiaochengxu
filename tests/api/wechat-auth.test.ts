import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

function stubFetch(body: unknown, init?: { ok?: boolean; status?: number }) {
  return vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: "OK",
    json: async () => body,
  })) as unknown as typeof globalThis.fetch;
}

describe("POST /api/auth/wechat", () => {
  let db = createInMemoryDb();
  let app: ReturnType<typeof buildApp> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    db.close();
    db = createInMemoryDb();
  });

  it("returns 503 when wechat is not configured", async () => {
    app = buildApp({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/wechat",
      payload: { code: "0a1b2c3d" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe("WECHAT_NOT_CONFIGURED");
  });

  it("creates a new user on first login for a given openid", async () => {
    const fetchStub = stubFetch({ openid: "o_abc123", unionid: "u_xyz" });
    app = buildApp({
      db,
      wechat: {
        appId: "wxTEST",
        appSecret: "secretTEST",
        fetch: fetchStub,
        endpoint: "https://api.weixin.qq.com/sns/jscode2session",
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/wechat",
      payload: { code: "login-code-1" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.userId).toEqual(expect.any(String));
    expect(body.token).toMatch(/^[0-9a-f]{48}$/);
    const row = db
      .prepare(
        "SELECT wechat_openid AS openid, wechat_union_id AS unionId FROM users WHERE id = ?",
      )
      .get(body.userId) as { openid: string; unionId: string };
    expect(row.openid).toBe("o_abc123");
    expect(row.unionId).toBe("u_xyz");

    // fetch called with right query params
    expect(fetchStub).toHaveBeenCalledOnce();
    const callUrl = new URL(
      (fetchStub as unknown as { mock: { calls: [string][] } }).mock
        .calls[0][0],
    );
    expect(callUrl.searchParams.get("appid")).toBe("wxTEST");
    expect(callUrl.searchParams.get("secret")).toBe("secretTEST");
    expect(callUrl.searchParams.get("js_code")).toBe("login-code-1");
    expect(callUrl.searchParams.get("grant_type")).toBe("authorization_code");
  });

  it("returns the existing user + token for a known openid", async () => {
    const fetchStub = stubFetch({ openid: "o_known" });
    app = buildApp({
      db,
      wechat: { appId: "wx", appSecret: "sec", fetch: fetchStub },
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/auth/wechat",
      payload: { code: "c1" },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/auth/wechat",
      payload: { code: "c2" },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().userId).toBe(first.json().userId);
    expect(second.json().token).toBe(first.json().token);

    const count = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE wechat_openid = ?")
      .get("o_known") as { n: number };
    expect(count.n).toBe(1);
  });

  it("returns 400 when jscode2session reports an errcode", async () => {
    const fetchStub = stubFetch({ errcode: 40029, errmsg: "invalid code" });
    app = buildApp({
      db,
      wechat: { appId: "wx", appSecret: "sec", fetch: fetchStub },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/wechat",
      payload: { code: "bad-code" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("WECHAT_AUTH_FAILED");
    expect(res.json().message).toContain("40029");
  });

  it("rejects missing code with 400 (schema)", async () => {
    app = buildApp({
      db,
      wechat: { appId: "wx", appSecret: "sec", fetch: stubFetch({}) },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/wechat",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("the wechat token is accepted by authenticated endpoints", async () => {
    const fetchStub = stubFetch({ openid: "o_auth_check" });
    app = buildApp({
      db,
      wechat: { appId: "wx", appSecret: "sec", fetch: fetchStub },
    });

    const auth = await app.inject({
      method: "POST",
      url: "/api/auth/wechat",
      payload: { code: "c" },
    });
    const { userId, token } = auth.json();

    const q = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      headers: { Authorization: `Bearer ${token}` },
      payload: { tool: "tro_alert", input: "nike" },
    });
    expect(q.statusCode).toBe(202);
    const { taskId } = q.json();
    const row = db
      .prepare("SELECT user_id AS userId FROM query_tasks WHERE id = ?")
      .get(taskId) as { userId: string };
    expect(row.userId).toBe(userId);
  });
});
