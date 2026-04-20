import Taro from "@tarojs/taro";

const API_BASE = "http://127.0.0.1:3000";

export async function createQueryTask(input: { tool: string; input: string }) {
  const response = await Taro.request({
    url: `${API_BASE}/api/query-tasks`,
    method: "POST",
    header: { "Content-Type": "application/json" },
    data: input,
  });

  return response.data;
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
  input: { email: string; phone?: string },
) {
  const response = await Taro.request({
    url: `${API_BASE}/api/reports/${reportId}/unlock`,
    method: "POST",
    header: { "Content-Type": "application/json" },
    data: input,
  });

  return response.data;
}

export async function listMessages() {
  const response = await Taro.request({
    url: `${API_BASE}/api/messages`,
    method: "GET",
  });
  return response.data;
}
