import nodemailer from 'nodemailer';
import { db } from './db.ts';
import type { EmailNotificationLog } from '../src/types/travel.ts';

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SendEmailInput {
  enquiryId?: number | null;
  to: string;
  type: EmailNotificationLog['notification_type'];
  subject: string;
  text: string;
  htmlParagraphs: string[];
  actionLabel?: string;
  actionUrl?: string;
}

export async function dispatchEmailNotification(input: SendEmailInput): Promise<{
  deliveryStatus: EmailNotificationLog['delivery_status'];
  errorMessage: string;
}> {
  const recipient = input.to.trim();
  let deliveryStatus: EmailNotificationLog['delivery_status'] = 'smtp_unconfigured';
  let errorMessage = '';

  const buttonHtml =
    input.actionUrl && input.actionLabel
      ? `<p style="margin:24px 0;"><a href="${escapeHtml(
          input.actionUrl
        )}" style="display:inline-block;padding:12px 22px;background:#0B1F3A;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(
          input.actionLabel
        )}</a></p>`
      : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;background:#ffffff;">
      <div style="border-bottom:2px solid #f59e0b;padding-bottom:12px;margin-bottom:18px;">
        <div style="font-size:16px;font-weight:700;color:#0B1F3A;">AAI EKVEERA MAULI TOURS &amp; TRAVEL</div>
        <div style="font-size:12px;color:#475569;">आपला विश्वास... आमची जबाबदारी...</div>
      </div>
      ${input.htmlParagraphs
        .map((p) => `<p style="font-size:14px;line-height:1.6;margin:0 0 12px;">${escapeHtml(p)}</p>`)
        .join('')}
      ${buttonHtml}
      ${
        input.actionUrl
          ? `<p style="font-size:12px;color:#64748b;word-break:break-all;">Direct link: ${escapeHtml(
              input.actionUrl
            )}</p>`
          : ''
      }
    </div>
  `;

  if (!recipient) {
    return { deliveryStatus: 'failed', errorMessage: 'No recipient email configured.' };
  }

  if (isSmtpConfigured()) {
    try {
      const port = Number(process.env.SMTP_PORT) || 587;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST!.trim(),
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        auth: {
          user: process.env.SMTP_USER!.trim(),
          pass: process.env.SMTP_PASS!.trim(),
        },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER!.trim(),
        to: recipient,
        subject: input.subject,
        text: input.text,
        html,
      });
      deliveryStatus = 'sent';
    } catch (err) {
      deliveryStatus = 'failed';
      errorMessage = err instanceof Error ? err.message : 'SMTP delivery failed.';
      console.error('SMTP send error:', err);
    }
  } else {
    errorMessage = 'SMTP environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS) not configured.';
  }

  // Never log password reset URLs in email_notifications table so reset tokens aren't exposed via admin log
  const loggedActionUrl = input.type === 'admin_password_reset' ? '' : input.actionUrl || '';
  const loggedBody =
    input.type === 'admin_password_reset'
      ? 'Password reset link dispatched to admin recovery email.'
      : input.text;

  db.prepare(
    `INSERT INTO email_notifications (
      enquiry_id, recipient_email, notification_type, subject, body_text, action_url, delivery_status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.enquiryId ?? null,
    recipient,
    input.type,
    input.subject.slice(0, 200),
    loggedBody.slice(0, 2000),
    loggedActionUrl.slice(0, 500),
    deliveryStatus,
    errorMessage.slice(0, 400)
  );

  return { deliveryStatus, errorMessage };
}
