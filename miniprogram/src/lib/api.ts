import Taro from "@tarojs/taro";
import type { QueryTaskResult } from "./query-result-view-model";
import type { ReportDetail } from "./report-detail-view-model";

const API_BASE = "http://127.0.0.1:3000";

export async function createQueryTask(input: {
  tool: string;
  input: string;
}): Promise<QueryTaskResult> {
  const response = await Taro.request({
    url: `${API_BASE}/api/query-tasks`,
    method: "POST",
    header: { "Content-Type": "application/json" },
    data: input,
  });

  return response.data as QueryTaskResult;
}

export async function listStoreProducts(storeName: string) {
  const response = await Taro.request({
    url: `${API_BASE}/api/storefronts/${encodeURIComponent(storeName)}/products`,
    method: "GET",
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
    header: { "Content-Type": "application/json" },
    data: input,
  });

  return response.data;
}

export async function createMonitor(input: {
  targetKind: string;
  targetValue: string;
  notifyEmail?: string;
  notifyPhone?: string;
}) {
  const response = await Taro.request({
    url: `${API_BASE}/api/monitors`,
    method: "POST",
    header: { "Content-Type": "application/json" },
    data: input,
  });

  return response.data;
}

export interface MonitorListItem {
  id: string;
  targetKind: string;
  targetValue: string;
  notifyEmail?: string | null;
  notifyPhone?: string | null;
  status: string;
}

export async function listMonitors(): Promise<{ items: MonitorListItem[] }> {
  const response = await Taro.request({
    url: `${API_BASE}/api/monitors`,
    method: "GET",
  });

  return response.data as { items: MonitorListItem[] };
}

export async function getReport(reportId: string): Promise<ReportDetail> {
  const response = await Taro.request({
    url: `${API_BASE}/api/reports/${reportId}`,
    method: "GET",
  });

  return response.data as ReportDetail;
}

export async function listMessages() {
  const response = await Taro.request({
    url: `${API_BASE}/api/messages`,
    method: "GET",
  });
  return response.data;
}
