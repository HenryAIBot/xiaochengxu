type PreviewLevel = "clear" | "watch" | "suspected_high" | "confirmed";

interface MonitorJob {
  monitorId: string;
  preview: {
    level: PreviewLevel;
    summary: string;
  };
}

interface MonitorProcessorPorts {
  sendEmail: (input: {
    to: string;
    subject: string;
    html: string;
  }) => Promise<unknown>;
  sendSms: (input: { to: string; body: string }) => Promise<unknown>;
  saveMessage: (input: { channel: string; body: string }) => Promise<unknown>;
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
    return;
  }

  await ports.sendEmail({
    to: "ops@example.com",
    subject: `监控 ${job.monitorId} 命中${LEVEL_LABELS[job.preview.level]}`,
    html: `<p>${job.preview.summary}</p>`,
  });

  await ports.sendSms({
    to: "+15551234567",
    body: `${LEVEL_LABELS[job.preview.level]}：${job.preview.summary}`,
  });

  await ports.saveMessage({
    channel: "system",
    body: job.preview.summary,
  });
}
