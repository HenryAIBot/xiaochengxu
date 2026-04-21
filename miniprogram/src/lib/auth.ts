import Taro from "@tarojs/taro";

const TOKEN_STORAGE_KEY = "userToken";
const USER_ID_STORAGE_KEY = "userId";

interface AnonymousAuthResponse {
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

async function requestAnonymousToken(): Promise<string> {
  const response = await Taro.request({
    url: `${apiBase()}/api/auth/anonymous`,
    method: "POST",
    header: { "Content-Type": "application/json" },
    data: {},
  });

  const payload = response.data as AnonymousAuthResponse;
  if (!payload?.token) {
    throw new Error("匿名鉴权失败：服务端未返回 token");
  }

  Taro.setStorageSync(TOKEN_STORAGE_KEY, payload.token);
  Taro.setStorageSync(USER_ID_STORAGE_KEY, payload.userId);
  cachedToken = payload.token;
  return payload.token;
}

export async function ensureUserToken(): Promise<string> {
  const cached = readCachedToken();
  if (cached) return cached;
  if (pending) return pending;

  pending = requestAnonymousToken().finally(() => {
    pending = null;
  });
  return pending;
}

export function __resetAuthForTests() {
  cachedToken = null;
  pending = null;
}
