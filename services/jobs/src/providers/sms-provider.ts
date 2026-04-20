export async function sendSms(input: { to: string; body: string }) {
  return {
    channel: "sms",
    delivered: true,
    to: input.to,
    body: input.body,
  };
}
