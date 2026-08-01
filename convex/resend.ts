import { Resend } from "resend";
import {
  isPipelineSmokeTestMode,
  logPipelineSmokeTest,
} from "./pipelineSmokeTest";

const RESEND_FROM = process.env.RESEND_FROM ?? "editor@mail.journalofaislop.com";

export interface ResendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendResendEmail = async (params: ResendEmailParams) => {
  if (isPipelineSmokeTestMode()) {
    logPipelineSmokeTest("Resend delivery suppressed", {
      subject: params.subject,
    });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY must be set to send email notifications");
  }

  const resend = new Resend(apiKey);
  return await resend.emails.send({
    from: RESEND_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
};
