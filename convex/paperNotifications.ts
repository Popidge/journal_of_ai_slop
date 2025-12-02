import { Id } from "./_generated/dataModel";
import { sendResendEmail } from "./resend";

type PaperStatus = "accepted" | "rejected";

const SITE_URL = (process.env.SITE_URL ?? "https://journalofaislop.com").replace(/\/$/, "");

const BRAND = {
  paper: "#f5ecd9",
  ink: "#231815",
  coffee: "#6b4a2f",
  coffeeLight: "#c49a6c",
  accent: "#296673",
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

const buildSubject = (status: PaperStatus) =>
  `The Journal of AI Slop™ — ${status === "accepted" ? "Accepted" : "Rejected"} Notification`;

const buildHeroLine = (status: PaperStatus) =>
  status === "accepted"
    ? "Crom has crowned your work slopworthy."
    : "Crom has judged this entry not sloppy enough.";

const buildStatusCopy = (status: PaperStatus) =>
  status === "accepted"
    ? "Your paper is officially accepted for publication. Expect a glorious procession of coffee rings and citations."
    : "Your paper has been rejected after peer review—no hard feelings, the slop is still real.";

export interface PaperStatusNotification {
  to: string;
  paperId: Id<"papers">;
  paperTitle: string;
  status: PaperStatus;
  reviewSummary?: string;
}

export const sendPaperStatusNotification = async (params: PaperStatusNotification) => {
  const ctaUrl = `${SITE_URL}/papers/${params.paperId}`;
  const subject = buildSubject(params.status);
  const safeTitle = escapeHtml(params.paperTitle);
  const safeSummary = escapeHtml(params.reviewSummary ?? (params.status === "accepted" ? "Stamped with 100% fully automated peer review." : "A council of bots provided their snap judgment."));

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:${BRAND.paper};font-family:'Courier Prime',serif;color:${BRAND.ink};">
    <div style="width:100%;padding:24px 0;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid ${BRAND.coffeeLight};padding:32px;box-shadow:0 20px 35px rgba(35,24,21,0.18);">
        <p style="margin:0 0 8px;font-size:0.8rem;letter-spacing:0.3em;text-transform:uppercase;color:${BRAND.coffee};">The Journal of AI Slop™</p>
        <h1 style="margin:0;font-size:1.9rem;line-height:1.2;color:${BRAND.ink};">${safeTitle}</h1>
        <p style="margin:12px 0 24px;font-size:1rem;color:${BRAND.ink};">${buildHeroLine(params.status)}</p>
        <div style="border:1px dashed ${BRAND.coffeeLight};border-radius:16px;padding:16px;background:${BRAND.paper};">
          <p style="margin:0;font-size:0.9rem;">Status: <strong style="color:${BRAND.coffee};text-transform:uppercase;">${params.status}</strong></p>
          <p style="margin:4px 0 0;font-size:0.95rem;color:${BRAND.ink};">${buildStatusCopy(params.status)}</p>
        </div>
        <p style="margin:24px 0 8px;font-size:0.9rem;color:${BRAND.ink};">Peer review notes:</p>
        <p style="margin:0 0 24px;font-size:0.95rem;color:${BRAND.ink};line-height:1.5;">${safeSummary}</p>
        <a href="${ctaUrl}" style="display:inline-flex;align-items:center;justify-content:center;padding:14px 26px;border-radius:999px;background:${BRAND.coffee};color:#fff;font-size:0.95rem;font-weight:600;text-decoration:none;">View the verdict</a>
        <p style="margin:24px 0 0;font-size:0.75rem;color:${BRAND.ink};letter-spacing:0.2em;text-transform:uppercase;">CROM IS WATCHING</p>
      </div>
    </div>
  </body>
</html>`;

  const text = `The Journal of AI Slop™ — ${params.status.toUpperCase()}\n
"${params.paperTitle}" has been ${params.status === "accepted" ? "accepted" : "rejected"} after peer review.\n
${params.reviewSummary ?? "The automated council rendered their verdict."}\n
Read more: ${ctaUrl}`;

  await sendResendEmail({
    to: params.to,
    subject,
    html,
    text,
  });
};
