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

export async function runMonitorProcessor(
  job: MonitorJob,
  ports: MonitorProcessorPorts,
) {
  if (job.preview.level === "clear") {
    return;
  }

  await ports.sendEmail({
    to: "ops@example.com",
    subject: `Monitor ${job.monitorId} hit ${job.preview.level}`,
    html: `<p>${job.preview.summary}</p>`,
  });

  await ports.sendSms({
    to: "+15551234567",
    body: `${job.preview.level}: ${job.preview.summary}`,
  });

  await ports.saveMessage({
    channel: "system",
    body: job.preview.summary,
  });
}
