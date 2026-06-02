import { logger } from "./logger";

// Resend-ready email abstraction. The transport is a thin wrapper so the
// rest of the app never imports a provider SDK directly. When RESEND_API_KEY
// is set in production the message is delivered via Resend's HTTP API; in
// dev (or when the key is missing) the message is logged and dropped — this
// keeps the platform self-hostable and lets tests assert against logger
// output without network calls.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // Operational tag for observability / queue routing.
  event:
    | "document.validated"
    | "document.rejected"
    | "step.blocked"
    | "task.assigned"
    | "appointment.created"
    | "student.assigned"
    | "visa.obtained"
    | "visa.refused"
    | "proactive.timeline";
  meta?: Record<string, unknown>;
}

const FROM = process.env["MAIL_FROM"] ?? "VisaFlow <noreply@visaflow.test>";

// Public-facing URL for the VisaFlow web app. Used to build deep links inside
// notification emails. Falls back to the Replit dev domain when present so
// that links in dev still resolve to the running preview.
export function appBaseUrl(): string {
  const explicit = process.env["APP_URL"];
  if (explicit) return explicit.replace(/\/+$/, "");
  const dev = process.env["REPLIT_DEV_DOMAIN"];
  if (dev) return `https://${dev}`;
  return "https://visaflow.test";
}

// Staff-facing dossier URL — `/app/students/:id` is the canonical detail page
// for advisors / reviewers / admins (see visaflow/src/App.tsx routes).
export function staffStudentLink(studentId: number): string {
  return `${appBaseUrl()}/app/students/${studentId}`;
}

// Student-facing section URL. The student-side app lives under `/student/*`
// with sub-pages: notifications, steps, documents, appointments, messages.
export function studentSelfLink(
  section?: "documents" | "appointments" | "steps" | "notifications" | "messages",
): string {
  const tail = section ? `/${section}` : "";
  return `${appBaseUrl()}/student${tail}`;
}

async function deliverViaResend(msg: MailMessage): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        tags: [{ name: "event", value: msg.event }],
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      logger.warn({ status: r.status, body, event: msg.event }, "Resend delivery failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, event: msg.event }, "Resend delivery threw");
    return false;
  }
}

export async function sendMail(msg: MailMessage): Promise<void> {
  // Swallow all errors — email is best-effort and must never block a request.
  try {
    if (!msg.to || !msg.subject) return;
    const delivered = await deliverViaResend(msg);
    if (!delivered) {
      logger.info(
        { event: msg.event, to: msg.to, subject: msg.subject, meta: msg.meta },
        "Mail (no provider configured — logged only)",
      );
    }
  } catch (err) {
    logger.warn({ err, event: msg.event }, "sendMail failed");
  }
}
