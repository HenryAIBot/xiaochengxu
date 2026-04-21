import { Button, Input, Text, View } from "@tarojs/components";
import { useState } from "react";
import {
  type FullReportViewModel,
  type ReportDetail,
  toFullReportViewModel,
} from "../lib/report-detail-view-model";

function readInputValue(event: {
  detail?: { value?: string };
  target?: { value?: string };
}) {
  return event.detail?.value ?? event.target?.value ?? "";
}

export function ReportUnlockScreen({
  onUnlock,
}: {
  onUnlock(input: {
    email?: string;
    phone?: string;
  }): undefined | ReportDetail | Promise<undefined | ReportDetail>;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [fullReport, setFullReport] = useState<FullReportViewModel | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitUnlock() {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail && !trimmedPhone) {
      setMessage("请输入邮箱或手机号");
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
    } catch {
      setMessage("报告解锁失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View>
      <Text>解锁完整报告</Text>
      <Text>查看完整证据、关联原因、案件列表和处理清单。</Text>
      <Input
        placeholder="邮箱"
        value={email}
        onInput={(event) => setEmail(readInputValue(event))}
        onChange={(event) => setEmail(readInputValue(event))}
      />
      <Input
        placeholder="手机号"
        value={phone}
        onInput={(event) => setPhone(readInputValue(event))}
        onChange={(event) => setPhone(readInputValue(event))}
      />
      <Text>邮箱或手机号任选其一</Text>
      {message ? <Text>{message}</Text> : null}
      <Button onClick={submitUnlock}>
        {isSubmitting ? "解锁中..." : "解锁完整报告"}
      </Button>

      {fullReport ? <FullReportContent report={fullReport} /> : null}
    </View>
  );
}

function FullReportContent({ report }: { report: FullReportViewModel }) {
  return (
    <View>
      {report.dataSource === "fixture" ? (
        <View>
          <Text>演示数据（非真实 API）</Text>
        </View>
      ) : null}
      {report.dataSource === "mixed" ? (
        <View>
          <Text>部分来源为演示数据</Text>
        </View>
      ) : null}
      <Text>完整报告</Text>
      <Text>查询对象：{report.queryInput}</Text>
      <Text>检测类型：{report.toolName}</Text>
      <Text>风险等级：{report.level}</Text>
      <Text>{report.summary}</Text>

      <View>
        <Text>完整证据</Text>
        {report.evidence.length > 0 ? (
          report.evidence.map((item) => (
            <View key={item.id}>
              <Text>{item.source}</Text>
              <Text>{item.level}</Text>
              <Text>{item.reason}</Text>
            </View>
          ))
        ) : (
          <Text>暂未发现可展示的关键证据</Text>
        )}
      </View>

      <View>
        <Text>处理清单</Text>
        {report.actions.map((action) => (
          <Text key={action}>{action}</Text>
        ))}
      </View>
    </View>
  );
}
