import { type Transporter, createTransport } from "nodemailer";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  channel: "email";
  delivered: boolean;
  to: string;
  subject: string;
  transport: "smtp" | "mock";
  messageId?: string;
}

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey: string | null = null;

function resolveTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;

  if (!host || !port) {
    return null;
  }

  const key = `${host}:${port}`;
  if (cachedTransporter && cachedTransporterKey === key) {
    return cachedTransporter;
  }

  cachedTransporter = createTransport({
    host,
    port: Number(port),
    secure: false,
    ignoreTLS: true,
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const transporter = resolveTransporter();
  const from = process.env.SMTP_FROM ?? "alerts@xiaochengxu.local";

  if (!transporter) {
    return {
      channel: "email",
      delivered: true,
      to: input.to,
      subject: input.subject,
      transport: "mock",
    };
  }

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  return {
    channel: "email",
    delivered: true,
    to: input.to,
    subject: input.subject,
    transport: "smtp",
    messageId: info.messageId,
  };
}

export function __resetEmailTransporterForTests() {
  cachedTransporter = null;
  cachedTransporterKey = null;
}
