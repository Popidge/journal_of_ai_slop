import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY must be set to send email notifications");
}

const RESEND_FROM = process.env.RESEND_FROM ?? "editor@mail.journalofaislop.com";

const resend = new Resend(RESEND_API_KEY);

export interface ResendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendResendEmail = async (params: ResendEmailParams) => {
  return await resend.emails.send({
    from: RESEND_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
};
