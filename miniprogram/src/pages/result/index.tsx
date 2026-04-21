import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useCallback, useEffect, useState } from "react";
import { ResultScreen } from "../../components/result-screen";
import { createMonitor, getQueryTask } from "../../lib/api";
import { PollTimeoutError, pollUntil } from "../../lib/polling";
import { readQueryResult, saveQueryResult } from "../../lib/query-result-cache";
import {
  type QueryTaskResult,
  flattenCompletedTask,
  toResultViewModel,
} from "../../lib/query-result-view-model";

type PageStatus =
  | { kind: "loading" }
  | { kind: "ready"; result: QueryTaskResult }
  | { kind: "failed"; reason: string };

export default function ResultPage() {
  const taskId = Taro.getCurrentInstance().router?.params?.id ?? "";
  const [pageStatus, setPageStatus] = useState<PageStatus>({ kind: "loading" });

  const hydrate = useCallback(async () => {
    if (!taskId) {
      setPageStatus({
        kind: "failed",
        reason: "缺少任务 ID，请返回首页重新检测",
      });
      return;
    }

    const cached = readQueryResult(taskId);
    if (cached && cached.status === "completed") {
      setPageStatus({ kind: "ready", result: cached });
      return;
    }

    setPageStatus({ kind: "loading" });

    try {
      const completed = await pollUntil(
        () => getQueryTask(taskId),
        (value) => value.status === "completed" || value.status === "failed",
        { intervalMs: 1500, timeoutMs: 30000 },
      );

      if (completed.status === "failed") {
        setPageStatus({
          kind: "failed",
          reason: completed.failureReason ?? "检测失败，请稍后重试",
        });
        return;
      }

      if (!completed.reportId || !completed.result) {
        setPageStatus({ kind: "failed", reason: "检测结果数据不完整" });
        return;
      }

      const flattened = flattenCompletedTask({
        taskId: completed.taskId,
        status: "completed",
        tool: completed.tool,
        normalizedInput: completed.normalizedInput,
        reportId: completed.reportId,
        result: completed.result,
      });
      saveQueryResult(flattened);
      setPageStatus({ kind: "ready", result: flattened });
    } catch (error) {
      const reason =
        error instanceof PollTimeoutError
          ? "检测耗时较长，请稍后重试"
          : error instanceof Error
            ? error.message
            : "检测过程中遇到未知错误";
      setPageStatus({ kind: "failed", reason });
    }
  }, [taskId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (pageStatus.kind === "loading") {
    return (
      <View>
        <Text>检测中…正在查询外部数据源</Text>
      </View>
    );
  }

  if (pageStatus.kind === "failed") {
    return (
      <View>
        <Text>检测失败</Text>
        <Text>{pageStatus.reason}</Text>
        <Button onClick={() => void hydrate()}>重试</Button>
        <Button onClick={() => Taro.navigateBack()}>返回首页</Button>
      </View>
    );
  }

  const viewModel = toResultViewModel(pageStatus.result);

  return (
    <View>
      <ResultScreen
        toolName={viewModel.toolName}
        level={viewModel.level}
        summary={viewModel.summary}
        updatedAt={viewModel.updatedAt}
        evidence={viewModel.evidence}
        actions={viewModel.actions}
        dataSource={viewModel.dataSource}
        onUnlockReport={() =>
          Taro.navigateTo({
            url: `/pages/report/index?id=${viewModel.reportId}`,
          })
        }
        onStartMonitor={async () => {
          await createMonitor(viewModel.monitorTarget);
          Taro.switchTab({ url: "/pages/monitor/index" });
        }}
        onContactAdvisor={() => Taro.switchTab({ url: "/pages/profile/index" })}
      />
    </View>
  );
}
