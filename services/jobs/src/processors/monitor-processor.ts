type PreviewLevel = "clear" | "watch" | "suspected_high" | "confirmed";

interface MonitorJob {
  monitorId: string;
  notifyEmail?: string | null;
  notifyPhone?: string | null;
  preview: {
    level: PreviewLevel;
    summary: string;
  };
}

interface SaveMessageInput {
  monitorId: string;
  level: PreviewLevel;
  channel: "email" | "sms" | "system";
  to: string | null;
  body: string;
}

interface MonitorProcessorPorts {
  sendEmail: (input: {
    to: string;
    subject: string;
    html: string;
  }) => Promise<unknown>;
  sendSms: (input: { to: string; body: string }) => Promise<unknown>;
  saveMessage: (input: SaveMessageInput) => Promise<unknown>;
}

const LEVEL_LABELS: Record<PreviewLevel, string> = {
  clear: "未发现明显风险",
  watch: "需关注",
  suspected_high: "疑似高风险",
  confirmed: "已确认风险",
};

export async function runMonitorProcessor(
  job: MonitorJob,
  ports: MonitorProcessorPorts,
) {
  if (job.preview.level === "clear") {
    return { skipped: true as const };
  }

  const levelLabel = LEVEL_LABELS[job.preview.level];
  const subject = `监控 ${job.monitorId} 命中${levelLabel}`;
  const emailBody = `<p>${job.preview.summary}</p>`;
  const smsBody = `${levelLabel}：${job.preview.summary}`;
  const delivered: Array<"email" | "sms"> = [];

  if (job.notifyEmail) {
    await ports.sendEmail({
      to: job.notifyEmail,
      subject,
      html: emailBody,
    });
    await ports.saveMessage({
      monitorId: job.monitorId,
      level: job.preview.level,
      channel: "email",
      to: job.notifyEmail,
      body: job.preview.summary,
    });
    delivered.push("email");
  }

  if (job.notifyPhone) {
    await ports.sendSms({
      to: job.notifyPhone,
      body: smsBody,
    });
    await ports.saveMessage({
      monitorId: job.monitorId,
      level: job.preview.level,
      channel: "sms",
      to: job.notifyPhone,
      body: smsBody,
    });
    delivered.push("sms");
  }

  if (delivered.length === 0) {
    await ports.saveMessage({
      monitorId: job.monitorId,
      level: job.preview.level,
      channel: "system",
      to: null,
      body: `${subject}：${job.preview.summary}（未配置通知渠道）`,
    });
  }

  return { skipped: false as const, delivered };
}
