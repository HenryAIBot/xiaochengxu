import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { ReportUnlockScreen } from "../../components/report-unlock-screen";
import { getReport, unlockReport } from "../../lib/api";

export default function ReportPage() {
  const reportId =
    Taro.getCurrentInstance().router?.params?.id ??
    Taro.getStorageSync("latestReportId") ??
    "report-1";

  return (
    <View>
      <View className="app-header">
        <Text className="app-header__title">检测报告</Text>
        <Text className="app-header__subtitle">解锁完整证据与处理清单</Text>
      </View>
      <ReportUnlockScreen
        onUnlock={async (payload) => {
          await unlockReport(reportId, payload);
          return getReport(reportId);
        }}
      />
    </View>
  );
}
