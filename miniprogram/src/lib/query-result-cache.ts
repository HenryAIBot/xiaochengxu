import Taro from "@tarojs/taro";
import type { QueryTaskResult } from "./query-result-view-model";

function cacheKey(taskId: string) {
  return `queryResult:${taskId}`;
}

export function saveQueryResult(result: QueryTaskResult) {
  Taro.setStorageSync(cacheKey(result.id), result);
  Taro.setStorageSync("latestQueryResultId", result.id);
  Taro.setStorageSync("latestReportId", result.reportId);
}

export function readQueryResult(taskId: string) {
  return Taro.getStorageSync(cacheKey(taskId)) as QueryTaskResult | undefined;
}
