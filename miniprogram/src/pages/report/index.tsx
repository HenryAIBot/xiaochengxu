import { View } from "@tarojs/components";
import { ReportUnlockScreen } from "../../components/report-unlock-screen";
import { unlockReport } from "../../lib/api";

export default function ReportPage() {
  return (
    <View>
      <ReportUnlockScreen
        onUnlock={(payload) => unlockReport("report-1", payload)}
      />
    </View>
  );
}
