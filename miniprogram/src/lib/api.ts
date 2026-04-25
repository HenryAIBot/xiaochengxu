import Taro from "@tarojs/taro";
import { ensureUserToken, readCachedToken } from "./auth";
import type { ReportDetail } from "./report-detail-view-model";

const API_BASE =
  (typeof process !== "undefined" && process.env?.TARO_APP_API_BASE) ||
  "http://127.0.0.1:3000";

/**
 * Always await a valid anonymous token before issuing any request. Using a
 * sync "best-effort" header in some call sites caused the very-first GET of a
 * fresh session to go out without Authorization, landing on the anonymous
 * bucket (`user_id IS NULL`) while the subsequent POST would correctly pick
 * up the newly-minted token — producing "list looks empty" bugs.
 */
async function buildAuthHeader(options: {
  contentType?: boolean;
}): Promise<Record<string, string>> {
  const header: Record<string, string> = {};
  if (options.contentType) {
    header["Content-Type"] = "application/json";
  }
  let token = readCachedToken();
  if (!token) {
    try {
      token = await ensureUserToken();
    } catch {
      token = null;
    }
  }
  if (token) {
    header.Authorization = `Bearer ${token}`;
  }
  return header;
}

export interface CreateQueryTaskResponse {
  taskId: string;
  status: string;
  normalizedInput: {
    kind: string;
    rawValue?: string;
    normalizedValue: string;
  };
}

export interface QueryTaskStatusResponse {
  taskId: string;
  status: string;
  tool: string;
  normalizedInput: {
    kind: string;
    rawValue?: string;
    normalizedValue: string;
  };
  createdAt: string;
  updatedAt?: string | null;
  reportId?: string;
  failureReason?: string;
  result?: {
    level: string;
    levelLabel: string;
    summary: string;
    evidence: Array<{ source: string; level: string; reason: string }>;
    recommendedActions: string[];
    extra?: unknown;
    dataSource?: string;
    createdAt?: string | null;
  };
}

export async function createQueryTask(input: {
  tool: string;
  input: string;
}): Promise<CreateQueryTaskResponse> {
  const response = await Taro.request({
    url: `${API_BASE}/api/query-tasks`,
    method: "POST",
    header: await buildAuthHeader({ contentType: true }),
    data: input,
  });

  const payload = response.data as
    | CreateQueryTaskResponse
    | { statusCode?: number; error?: string; message?: string; code?: string }
    | null;

  if (
    !payload ||
    typeof (payload as CreateQueryTaskResponse).taskId !== "string"
  ) {
    const message =
      (payload as { message?: string } | null)?.message ??
      `创建检测任务失败 (HTTP ${response.statusCode ?? "unknown"})`;
    throw new Error(message);
  }

  return payload as CreateQueryTaskResponse;
}

export async function getQueryTask(
  taskId: string,
): Promise<QueryTaskStatusResponse> {
  const response = await Taro.request({
    url: `${API_BASE}/api/query-tasks/${taskId}`,
    method: "GET",
    header: await buildAuthHeader({}),
  });
  return response.data as QueryTaskStatusResponse;
}

export async function listStoreProducts(storeName: string) {
  const response = await Taro.request({
    url: `${API_BASE}/api/storefronts/${encodeURIComponent(storeName)}/products`,
    method: "GET",
    header: await buildAuthHeader({}),
  });
  return response.data;
}

export async function unlockReport(
  reportId: string,
  input: { email?: string; phone?: string },
) {
  const response = await Taro.request({
    url: `${API_BASE}/api/reports/${reportId}/unlock`,
    method: "POST",
    header: await buildAuthHeader({ contentType: true }),
    data: input,
  });

  const payload = response.data as
    | { id: string; unlocked: boolean; fullReportUrl: string }
    | { code?: string; message?: string }
    | null;

  if (!payload || !(payload as { unlocked?: boolean }).unlocked) {
    const message =
      (payload as { message?: string } | null)?.message ??
      `解锁失败 (HTTP ${response.statusCode ?? "unknown"})`;
    throw new Error(message);
  }

  return payload;
}

export async function createMonitor(input: {
  targetKind: string;
  targetValue: string;
  notifyEmail?: string;
  notifyPhone?: string;
  tickIntervalSeconds?: number;
}) {
  const response = await Taro.request({
    url: `${API_BASE}/api/monitors`,
    method: "POST",
    header: await buildAuthHeader({ contentType: true }),
    data: input,
  });

  const payload = response.data as
    | { id: string; status: string }
    | { code?: string; message?: string }
    | null;

  if (!payload || typeof (payload as { id?: string }).id !== "string") {
    const message =
      (payload as { message?: string } | null)?.message ??
      `创建监控失败 (HTTP ${response.statusCode ?? "unknown"})`;
    throw new Error(message);
  }

  return payload;
}

export interface MonitorListItem {
  id: string;
  targetKind: string;
  targetValue: string;
  notifyEmail?: string | null;
  notifyPhone?: string | null;
  status: string;
  tickIntervalSeconds?: number | null;
  lastCheckedAt?: string | null;
}

export async function listMonitors(): Promise<{ items: MonitorListItem[] }> {
  const response = await Taro.request({
    url: `${API_BASE}/api/monitors`,
    method: "GET",
    header: await buildAuthHeader({}),
  });

  return response.data as { items: MonitorListItem[] };
}

export interface StatsResponse {
  activeMonitors: number;
  detectionsThisWeek: number;
  riskWarnings: number;
  confirmedTro: number;
}

export async function getStats(): Promise<StatsResponse> {
  const response = await Taro.request({
    url: `${API_BASE}/api/stats`,
    method: "GET",
    header: await buildAuthHeader({}),
  });
  const payload = response.data as StatsResponse | null;
  return (
    payload ?? {
      activeMonitors: 0,
      detectionsThisWeek: 0,
      riskWarnings: 0,
      confirmedTro: 0,
    }
  );
}

export async function updateMonitorStatus(
  id: string,
  status: "active" | "paused",
) {
  const response = await Taro.request({
    url: `${API_BASE}/api/monitors/${id}`,
    method: "PATCH",
    header: await buildAuthHeader({ contentType: true }),
    data: { status },
  });
  return response.data;
}

export async function updateMonitorInterval(
  id: string,
  tickIntervalSeconds: number,
) {
  const response = await Taro.request({
    url: `${API_BASE}/api/monitors/${id}`,
    method: "PATCH",
    header: await buildAuthHeader({ contentType: true }),
    data: { tickIntervalSeconds },
  });
  return response.data;
}

export async function deleteMonitor(id: string) {
  await Taro.request({
    url: `${API_BASE}/api/monitors/${id}`,
    method: "DELETE",
    header: await buildAuthHeader({}),
  });
}

export async function getReport(reportId: string): Promise<ReportDetail> {
  const response = await Taro.request({
    url: `${API_BASE}/api/reports/${reportId}`,
    method: "GET",
    header: await buildAuthHeader({}),
  });

  const payload = response.data as
    | ReportDetail
    | { code?: string; message?: string }
    | null;

  if (!payload || typeof (payload as ReportDetail).id !== "string") {
    const message =
      (payload as { message?: string } | null)?.message ??
      `无法加载报告 (HTTP ${response.statusCode ?? "unknown"})`;
    throw new Error(message);
  }

  return payload as ReportDetail;
}

export interface MessageItem {
  id: string;
  channel: "email" | "sms" | "system";
  body: string;
  monitorId: string | null;
  level: string | null;
  toAddress: string | null;
  createdAt: string;
}

export interface ConsultationTargetRef {
  kind: "brand" | "store" | "asin" | "amazon_url" | "case_number";
  value: string;
}

export interface ConsultationItem {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  status: string;
  advisor: string | null;
  advisorId?: string | null;
  advisorSpecialty?: string | null;
  targetRef?: ConsultationTargetRef | null;
  sourceReportId?: string | null;
  sourceQueryTaskId?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AdvisorListItem {
  id: string;
  name: string;
  specialty: string | null;
}

export async function listAdvisors(): Promise<AdvisorListItem[]> {
  const response = await Taro.request({
    url: `${API_BASE}/api/advisors`,
    method: "GET",
    header: await buildAuthHeader({}),
  });
  const payload = response.data as { items?: AdvisorListItem[] } | null;
  return payload?.items ?? [];
}

export async function createConsultation(input: {
  name: string;
  phone: string;
  note?: string;
  targetRef?: ConsultationTargetRef;
  sourceReportId?: string;
  sourceQueryTaskId?: string;
}): Promise<ConsultationItem> {
  const response = await Taro.request({
    url: `${API_BASE}/api/consultations`,
    method: "POST",
    header: await buildAuthHeader({ contentType: true }),
    data: input,
  });

  const payload = response.data as
    | ConsultationItem
    | { statusCode?: number; code?: string; message?: string }
    | null;

  if (!payload || typeof (payload as ConsultationItem).id !== "string") {
    const message =
      (payload as { message?: string } | null)?.message ??
      `提交咨询失败 (HTTP ${response.statusCode ?? "unknown"})`;
    throw new Error(message);
  }

  return payload as ConsultationItem;
}

export async function updateConsultation(
  id: string,
  patch: { status?: ConsultationItem["status"]; note?: string },
): Promise<ConsultationItem> {
  const response = await Taro.request({
    url: `${API_BASE}/api/consultations/${id}`,
    method: "PATCH",
    header: await buildAuthHeader({ contentType: true }),
    data: patch,
  });
  const payload = response.data as
    | ConsultationItem
    | { message?: string }
    | null;
  if (!payload || typeof (payload as ConsultationItem).id !== "string") {
    const message =
      (payload as { message?: string } | null)?.message ??
      `更新咨询失败 (HTTP ${response.statusCode ?? "unknown"})`;
    throw new Error(message);
  }
  return payload as ConsultationItem;
}

export async function listConsultations(): Promise<{
  items: ConsultationItem[];
}> {
  const response = await Taro.request({
    url: `${API_BASE}/api/consultations`,
    method: "GET",
    header: await buildAuthHeader({}),
  });
  return response.data as { items: ConsultationItem[] };
}

export async function listMessages(): Promise<MessageItem[]> {
  const response = await Taro.request({
    url: `${API_BASE}/api/messages`,
    method: "GET",
    header: await buildAuthHeader({}),
  });
  return (response.data as MessageItem[]) ?? [];
}
