import { db, notificationsTable, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendMail, type MailMessage } from "./mailer";

export type NotifyEvent =
  | MailMessage["event"]
  | "bulk_import.completed"
  | "comment.added"
  | "document.review.requested"
  | "generic";

export interface NotifyInput {
  userId: number;
  studentId?: number | null;
  title: string;
  message: string;
  type?: string;
  event?: NotifyEvent;
  emailSubject?: string;
  emailHtml?: string;
}

async function deliverSmsTwilio(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) return false;
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    });
    if (!r.ok) {
      logger.warn({ status: r.status, to }, "Twilio SMS failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, to }, "Twilio SMS threw");
    return false;
  }
}

async function deliverWhatsapp(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return false;
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
        To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
        Body: body,
      }).toString(),
    });
    if (!r.ok) {
      logger.warn({ status: r.status, to }, "Twilio WhatsApp failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, to }, "Twilio WhatsApp threw");
    return false;
  }
}

/**
 * Multi-channel notification fan-out. Always inserts the in-app notification
 * row, then opportunistically sends through email / SMS / WhatsApp depending
 * on the user's per-channel preferences and contact info. Every external
 * channel is best-effort and never throws.
 */
export async function notify(input: NotifyInput): Promise<void> {
  // 1. In-app row — always.
  try {
    await db.insert(notificationsTable).values({
      userId: input.userId,
      studentId: input.studentId ?? null,
      title: input.title,
      message: input.message,
      type: input.type ?? input.event ?? "info",
    });
  } catch (err) {
    logger.warn({ err }, "notify: in-app insert failed");
  }

  let user: User | undefined;
  try {
    [user] = await db.select().from(usersTable).where(eq(usersTable.id, input.userId));
  } catch (err) {
    logger.warn({ err, userId: input.userId }, "notify: user lookup failed");
    return;
  }
  if (!user) return;

  const body = `${input.title}\n\n${input.message}`;

  // Email fan-out: gated on the per-user `notifyEmail` preference. Caller
  // opts in by passing `event` — call sites that already drive their own
  // richer email via sendMail() omit `event` so we don't double-send.
  if (user.notifyEmail && user.email && input.event && input.event !== "generic") {
    // Map non-mail-tag notify events to the closest existing mail event tag
    // (purely an observability label).
    const evt: MailMessage["event"] =
      input.event === "bulk_import.completed" ||
      input.event === "comment.added" ||
      input.event === "document.review.requested"
        ? "task.assigned"
        : (input.event as MailMessage["event"]);
    await sendMail({
      to: user.email,
      subject: input.emailSubject ?? input.title,
      text: body,
      html: input.emailHtml,
      event: evt,
    });
  }
  if (user.notifySms && user.phone) {
    await deliverSmsTwilio(user.phone, body);
  }
  if (user.notifyWhatsapp) {
    const wa = user.whatsappNumber || user.phone;
    if (wa) await deliverWhatsapp(wa, body);
  }
}
