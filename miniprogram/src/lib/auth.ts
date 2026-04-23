import Taro from "@tarojs/taro";

const TOKEN_STORAGE_KEY = "userToken";
const USER_ID_STORAGE_KEY = "userId";

interface TokenResponse {
  userId: string;
  token: string;
}

let cachedToken: string | null = null;
let pending: Promise<string> | null = null;

function apiBase(): string {
  return (
    (typeof process !== "undefined" && process.env?.TARO_APP_API_BASE) ||
    "http://127.0.0.1:3000"
  );
}

export function readCachedToken(): string | null {
  if (cachedToken) return cachedToken;
  try {
    const stored = Taro.getStorageSync(TOKEN_STORAGE_KEY);
    if (typeof stored === "string" && stored.length > 0) {
      cachedToken = stored;
      return cachedToken;
    }
  } catch {
    // storage not available (e.g. in unit-test mocks); treat as no token
  }
  return null;
}

function isWeappEnv(): boolean {
  try {
    return Taro.getEnv?.() === Taro.ENV_TYPE.WEAPP;
  } catch {
    return false;
  }
}

async function wxLoginCode(): Promise<string | null> {
  try {
    const { code } = await Taro.login();
    return typeof code === "string" && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

function persistAndReturn(payload: TokenResponse): string {
  try {
    Taro.setStorageSync(TOKEN_STORAGE_KEY, payload.token);
    Taro.setStorageSync(USER_ID_STORAGE_KEY, payload.userId);
  } catch {
    // non-fatal in test environments
  }
  cachedToken = payload.token;
  return payload.token;
}

async function requestWechatToken(code: string): Promise<string | null> {
  try {
    const response = await Taro.request({
      url: `${apiBase()}/api/auth/wechat`,
      method: "POST",
      header: { "Content-Type": "application/json" },
      data: { code },
    });
    const statusCode = (response as { statusCode?: number }).statusCode ?? 200;
    if (statusCode >= 400) return null;
    const payload = response.data as TokenResponse;
    if (!payload?.token) return null;
    return persistAndReturn(payload);
  } catch {
    return null;
  }
}

async function requestAnonymousToken(): Promise<string> {
  const response = await Taro.request({
    url: `${apiBase()}/api/auth/anonymous`,
    method: "POST",
    header: { "Content-Type": "application/json" },
    data: {},
  });
  const payload = response.data as TokenResponse;
  if (!payload?.token) {
    throw new Error("匿名鉴权失败：服务端未返回 token");
  }
  return persistAndReturn(payload);
}

async function acquireToken(): Promise<string> {
  if (isWeappEnv()) {
    const code = await wxLoginCode();
    if (code) {
      const wechatToken = await requestWechatToken(code);
      if (wechatToken) return wechatToken;
    }
  }
  return requestAnonymousToken();
}

export async function ensureUserToken(): Promise<string> {
  const cached = readCachedToken();
  if (cached) return cached;
  if (pending) return pending;

  pending = acquireToken().finally(() => {
    pending = null;
  });
  return pending;
}

export function __resetAuthForTests() {
  cachedToken = null;
  pending = null;
}
