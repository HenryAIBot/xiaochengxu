import { View } from "@tarojs/components";
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
      <ReportUnlockScreen
        onUnlock={async (payload) => {
          await unlockReport(reportId, payload);
          return getReport(reportId);
        }}
      />
    </View>
  );
}
