import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { ResultScreen } from "../../components/result-screen";
import { createMonitor } from "../../lib/api";
import { readQueryResult } from "../../lib/query-result-cache";
import { toResultViewModel } from "../../lib/query-result-view-model";

export default function ResultPage() {
  const taskId = Taro.getCurrentInstance().router?.params?.id ?? "";
  const queryResult = taskId ? readQueryResult(taskId) : undefined;
  const viewModel = queryResult ? toResultViewModel(queryResult) : null;

  if (!viewModel) {
    return <View>未找到检测结果，请返回首页重新检测</View>;
  }

  return (
    <View>
      <ResultScreen
        toolName={viewModel.toolName}
        level={viewModel.level}
        summary={viewModel.summary}
        updatedAt={viewModel.updatedAt}
        evidence={viewModel.evidence}
        actions={viewModel.actions}
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
