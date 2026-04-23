export interface WeChatAuthConfig {
  appId: string;
  appSecret: string;
  /**
   * Override for the `jscode2session` endpoint. Defaults to the
   * official URL; tests inject a stub to avoid real network calls.
   */
  fetch?: typeof globalThis.fetch;
  /** Override for the endpoint URL. Defaults to the official WeChat URL. */
  endpoint?: string;
}

export interface JsCode2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

const DEFAULT_ENDPOINT = "https://api.weixin.qq.com/sns/jscode2session";

export async function exchangeCodeForOpenId(
  code: string,
  config: WeChatAuthConfig,
): Promise<{ openId: string; unionId: string | null }> {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  const base = config.endpoint ?? DEFAULT_ENDPOINT;
  const url = new URL(base);
  url.searchParams.set("appid", config.appId);
  url.searchParams.set("secret", config.appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetchImpl(url.toString(), { method: "GET" });
  if (!response.ok) {
    throw new Error(
      `WeChat jscode2session HTTP ${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.json()) as JsCode2SessionResponse;

  if (body.errcode && body.errcode !== 0) {
    throw new Error(
      `WeChat jscode2session error ${body.errcode}: ${body.errmsg ?? "unknown"}`,
    );
  }
  if (!body.openid) {
    throw new Error("WeChat jscode2session response missing openid");
  }
  return { openId: body.openid, unionId: body.unionid ?? null };
}
