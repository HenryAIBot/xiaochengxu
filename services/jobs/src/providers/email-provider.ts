export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  return {
    channel: "email",
    delivered: true,
    to: input.to,
    subject: input.subject,
  };
}
