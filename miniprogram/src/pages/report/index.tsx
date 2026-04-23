import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { ReportUnlockScreen } from "../../components/report-unlock-screen";
import { getReport, unlockReport } from "../../lib/api";
import { setConsultationContext } from "../../lib/consultation-context";

function routeAction(action: string) {
  if (/顾问|联系|咨询|申诉|和解/.test(action)) {
    Taro.switchTab({ url: "/pages/profile/index" });
    return;
  }
  if (/监控|持续观察|继续观察|关注/.test(action)) {
    Taro.switchTab({ url: "/pages/monitor/index" });
    return;
  }
  Taro.showToast({ title: action, icon: "none", duration: 3000 });
}

const LAST_CONTACT_STORAGE_KEY = "lastUnlockContact";

function readLastContact(): { email?: string; phone?: string } {
  try {
    const raw = Taro.getStorageSync(LAST_CONTACT_STORAGE_KEY);
    if (raw && typeof raw === "object") {
      return raw as { email?: string; phone?: string };
    }
  } catch {
    // ignore storage errors in test envs
  }
  return {};
}

function rememberContact(payload: { email?: string; phone?: string }) {
  try {
    Taro.setStorageSync(LAST_CONTACT_STORAGE_KEY, payload);
  } catch {
    // non-fatal
  }
}

export default function ReportPage() {
  const reportId =
    Taro.getCurrentInstance().router?.params?.id ??
    Taro.getStorageSync("latestReportId") ??
    "report-1";
  const lastContact = readLastContact();

  return (
    <View>
      <View className="app-header">
        <Text className="app-header__title">检测报告</Text>
        <Text className="app-header__subtitle">解锁完整证据与处理清单</Text>
      </View>
      <ReportUnlockScreen
        defaultEmail={lastContact.email}
        defaultPhone={lastContact.phone}
        onUnlock={async (payload) => {
          rememberContact(payload);
          await unlockReport(reportId, payload);
          return getReport(reportId);
        }}
        onActionTap={routeAction}
        onContactAdvisor={() => {
          setConsultationContext({
            sourceReportId: reportId,
            label: `报告 ${reportId}`,
          });
          Taro.switchTab({ url: "/pages/profile/index" });
        }}
        onStartMonitor={() => Taro.switchTab({ url: "/pages/monitor/index" })}
      />
    </View>
  );
}
