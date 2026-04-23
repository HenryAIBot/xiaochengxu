import { Button, Input, Text, View } from "@tarojs/components";
import { useState } from "react";
import {
  type FullReportViewModel,
  type ReportDetail,
  toFullReportViewModel,
} from "../lib/report-detail-view-model";

const LEVEL_BADGE: Record<string, string> = {
  未发现明显风险: "badge badge--clear",
  需关注: "badge badge--watch",
  疑似高风险: "badge badge--high",
  已确认风险: "badge badge--confirmed",
};

function readInputValue(event: {
  detail?: { value?: string };
  target?: { value?: string };
}) {
  return event.detail?.value ?? event.target?.value ?? "";
}

export function ReportUnlockScreen({
  onUnlock,
  onActionTap,
  onContactAdvisor,
  onStartMonitor,
  defaultEmail,
  defaultPhone,
}: {
  onUnlock(input: {
    email?: string;
    phone?: string;
  }): undefined | ReportDetail | Promise<undefined | ReportDetail>;
  onActionTap?: (action: string) => void;
  onContactAdvisor?: () => void;
  onStartMonitor?: () => void;
  /** Prefilled from the logged-in user's previously-submitted consultation. */
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");
  const [fullReport, setFullReport] = useState<FullReportViewModel | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitUnlock() {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail && !trimmedPhone) {
      setMessage("请输入邮箱或手机号");
      setMessageTone("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const report = await onUnlock({
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      });

      if (report) {
        setFullReport(toFullReportViewModel(report));
      }

      setMessage("完整报告已解锁");
      setMessageTone("ok");
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "报告解锁失败，请稍后重试";
      setMessage(reason);
      setMessageTone("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="page">
      <View className="card">
        <Text className="card__title">解锁完整报告</Text>
        <Text className="card__text">
          查看完整证据、关联原因、案件列表和处理清单
        </Text>
        <Input
          className="input"
          placeholder="邮箱地址"
          value={email}
          onInput={(event) => setEmail(readInputValue(event))}
          onChange={(event) => setEmail(readInputValue(event))}
        />
        <Input
          className="input"
          placeholder="手机号（选填）"
          value={phone}
          onInput={(event) => setPhone(readInputValue(event))}
          onChange={(event) => setPhone(readInputValue(event))}
        />
        <Text className="hint">邮箱或手机号任选其一；仅用于报告推送</Text>
        {message ? (
          <Text
            className={messageTone === "error" ? "hint hint--error" : "hint"}
          >
            {message}
          </Text>
        ) : null}
        <Button
          className="btn btn--primary btn--block"
          style={{ marginTop: "14px" }}
          onClick={submitUnlock}
        >
          {isSubmitting ? "解锁中..." : "立即解锁"}
        </Button>
      </View>

      {fullReport ? (
        <FullReportContent
          report={fullReport}
          onActionTap={onActionTap}
          onContactAdvisor={onContactAdvisor}
          onStartMonitor={onStartMonitor}
        />
      ) : null}
    </View>
  );
}

function FullReportContent({
  report,
  onActionTap,
  onContactAdvisor,
  onStartMonitor,
}: {
  report: FullReportViewModel;
  onActionTap?: (action: string) => void;
  onContactAdvisor?: () => void;
  onStartMonitor?: () => void;
}) {
  const levelClass = LEVEL_BADGE[report.level] ?? "badge";
  return (
    <View className="card">
      {report.dataSource === "fixture" ? (
        <Text className="badge badge--fixture">演示数据（非真实 API）</Text>
      ) : null}
      {report.dataSource === "mixed" ? (
        <Text className="badge badge--fixture">部分来源为演示数据</Text>
      ) : null}

      <Text className={levelClass}>{report.level}</Text>
      <Text className="card__title" style={{ marginTop: "10px" }}>
        完整报告
      </Text>
      <Text className="card__text">查询对象：{report.queryInput}</Text>
      <Text className="card__text">检测类型：{report.toolName}</Text>
      <Text className="card__text" style={{ marginTop: "8px" }}>
        {report.summary}
      </Text>

      <View className="section">
        <Text className="section__title">完整证据</Text>
        {report.evidence.length > 0 ? (
          report.evidence.map((item) => (
            <View key={item.id} className="evidence-item">
              <Text className="evidence-item__title">{item.source}</Text>
              <Text className="evidence-item__source">等级：{item.level}</Text>
              <Text className="evidence-item__body">{item.reason}</Text>
            </View>
          ))
        ) : (
          <Text className="card__text">暂未发现可展示的关键证据</Text>
        )}
      </View>

      <View className="section">
        <Text className="section__title">处理清单</Text>
        <View className="action-list">
          {report.actions.map((action) => (
            <View
              key={action}
              className={
                onActionTap
                  ? "action-list__item action-list__item--tappable"
                  : "action-list__item"
              }
              onClick={onActionTap ? () => onActionTap(action) : undefined}
            >
              <Text>{action}</Text>
            </View>
          ))}
        </View>
        {onContactAdvisor || onStartMonitor ? (
          <View className="list-item__actions" style={{ marginTop: "12px" }}>
            {onContactAdvisor ? (
              <Button
                className="btn btn--primary btn--block"
                onClick={onContactAdvisor}
              >
                立即联系顾问
              </Button>
            ) : null}
            {onStartMonitor ? (
              <Button
                className="btn btn--ghost btn--block"
                onClick={onStartMonitor}
              >
                加入持续监控
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
