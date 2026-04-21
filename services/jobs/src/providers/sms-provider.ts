interface SendSmsInput {
  to: string;
  body: string;
}

interface SendSmsResult {
  channel: "sms";
  delivered: boolean;
  to: string;
  body: string;
  provider: "mock" | "external";
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "mock";

  if (provider === "mock") {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[sms:mock] -> ${input.to}: ${input.body}`);
    }
    return {
      channel: "sms",
      delivered: true,
      to: input.to,
      body: input.body,
      provider: "mock",
    };
  }

  throw new Error(`SMS provider "${provider}" is not implemented yet`);
}
