export interface AdvisorNotificationJob {
  consultationId: string;
  advisorId: string;
  advisorName: string;
  advisorEmail: string | null;
  clientName: string;
  clientPhone: string;
  note: string | null;
  targetRef: { kind: string; value: string } | null;
  sourceReportId: string | null;
}

export interface AdvisorNotificationDependencies {
  sendEmail: (input: {
    to: string;
    subject: string;
    html: string;
  }) => Promise<{ delivered: boolean; transport: string; messageId?: string }>;
}

const KIND_LABEL: Record<string, string> = {
  brand: "品牌",
  store: "店铺",
  asin: "ASIN",
  amazon_url: "商品链接",
  case_number: "案件号",
};

function renderHtml(job: AdvisorNotificationJob) {
  const target = job.targetRef
    ? `<li><b>咨询对象：</b>${KIND_LABEL[job.targetRef.kind] ?? job.targetRef.kind} · ${job.targetRef.value}</li>`
    : "";
  const note = job.note ? `<li><b>备注：</b>${job.note}</li>` : "";
  const report = job.sourceReportId
    ? `<li><b>关联报告：</b>${job.sourceReportId}</li>`
    : "";
  return `
    <p>${job.advisorName} 您好，系统为您分配了一条新的咨询，请尽快联系客户。</p>
    <ul>
      <li><b>客户：</b>${job.clientName}</li>
      <li><b>联系电话：</b>${job.clientPhone}</li>
      ${target}
      ${note}
      ${report}
      <li><b>咨询编号：</b>${job.consultationId}</li>
    </ul>
  `;
}

export async function runAdvisorNotificationProcessor(
  job: AdvisorNotificationJob,
  deps: AdvisorNotificationDependencies,
): Promise<{
  consultationId: string;
  advisorId: string;
  emailed: boolean;
  transport?: string;
}> {
  if (!job.advisorEmail) {
    return {
      consultationId: job.consultationId,
      advisorId: job.advisorId,
      emailed: false,
    };
  }
  const result = await deps.sendEmail({
    to: job.advisorEmail,
    subject: `【新咨询】${job.clientName} · ${job.targetRef?.value ?? "未指定对象"}`,
    html: renderHtml(job),
  });
  return {
    consultationId: job.consultationId,
    advisorId: job.advisorId,
    emailed: result.delivered,
    transport: result.transport,
  };
}
