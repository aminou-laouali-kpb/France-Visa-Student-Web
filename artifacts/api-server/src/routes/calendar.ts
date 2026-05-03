import { Router, type IRouter } from "express";
import {
  db,
  appointmentsTable,
  studentsTable,
  postArrivalStepsTable,
  usersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAuth, isStaff, canAccessStudent } from "../middlewares/auth";

const router: IRouter = Router();

function escapeIcs(s: string): string {
  return s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");
}

function fmtDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function fmtDateOnly(s: string): string {
  // s is "YYYY-MM-DD"
  return s.replace(/-/g, "");
}

interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
}

function buildIcs(name: string, events: IcsEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VisaFlow//VisaFlow Calendar//EN",
    `X-WR-CALNAME:${escapeIcs(name)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const now = fmtDate(new Date());
  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}@visaflow`);
    lines.push(`DTSTAMP:${now}`);
    if (ev.allDay && typeof ev.start === "string") {
      lines.push(`DTSTART;VALUE=DATE:${fmtDateOnly(ev.start)}`);
    } else if (ev.start instanceof Date) {
      lines.push(`DTSTART:${fmtDate(ev.start)}`);
      lines.push(`DTEND:${fmtDate(ev.end instanceof Date ? ev.end : new Date(ev.start.getTime() + 60 * 60 * 1000))}`);
    }
    lines.push(`SUMMARY:${escapeIcs(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcs(ev.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

async function studentEvents(studentId: number): Promise<IcsEvent[]> {
  const events: IcsEvent[] = [];
  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.studentId, studentId));
  for (const a of appts) {
    events.push({
      uid: `appt-${a.id}`,
      summary: `[${a.type}] ${a.title}`,
      description: a.notes ?? undefined,
      location: [a.centre, a.location].filter(Boolean).join(" — "),
      start: a.scheduledAt,
    });
  }
  const paSteps = await db
    .select()
    .from(postArrivalStepsTable)
    .where(eq(postArrivalStepsTable.studentId, studentId));
  for (const s of paSteps) {
    if (s.dueDate) {
      events.push({
        uid: `pa-step-${s.id}`,
        summary: `Post-arrivée: ${s.label}`,
        description: s.notes ?? undefined,
        start: s.dueDate,
        allDay: true,
      });
    }
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  if (student?.intakeDate) {
    events.push({
      uid: `intake-${studentId}`,
      summary: "Rentrée / intake",
      start: student.intakeDate,
      allDay: true,
    });
  }
  if (student?.titreExpiryDate) {
    events.push({
      uid: `titre-${studentId}`,
      summary: "Expiration titre de séjour",
      start: student.titreExpiryDate,
      allDay: true,
    });
  }
  return events;
}

// ICS feed for one student — staff or the student themselves.
router.get("/students/:studentId/calendar.ics", requireAuth, async (req, res) => {
  const id = Number(req.params.studentId);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) {
    res.status(404).send("not_found");
    return;
  }
  if (!canAccessStudent(req.currentUser!, student)) {
    res.status(403).send("forbidden");
    return;
  }
  const events = await studentEvents(id);
  const ics = buildIcs(`VisaFlow — ${student.firstName} ${student.lastName}`, events);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="visaflow-student-${id}.ics"`);
  res.send(ics);
});

async function eventsForUser(u: {
  id: number;
  role: string;
  tenantId: number | null;
  firstName: string;
  lastName: string;
}): Promise<{ name: string; events: IcsEvent[] }> {
  let studentIds: number[] = [];
  if (u.role === "student") {
    const mine = await db.select().from(studentsTable).where(eq(studentsTable.userId, u.id));
    studentIds = mine.map((s) => s.id);
  } else {
    const filter = u.role === "advisor"
      ? eq(studentsTable.advisorId, u.id)
      : u.role === "reviewer"
        ? eq(studentsTable.reviewerId, u.id)
        : undefined;
    const tenantFilter = u.role === "superadmin" ? undefined : eq(studentsTable.tenantId, u.tenantId ?? 1);
    const where = filter && tenantFilter ? and(filter, tenantFilter) : (filter ?? tenantFilter);
    const rows = where
      ? await db.select({ id: studentsTable.id }).from(studentsTable).where(where)
      : await db.select({ id: studentsTable.id }).from(studentsTable);
    studentIds = rows.map((r) => r.id);
  }
  let events: IcsEvent[] = [];
  for (const id of studentIds) {
    events = events.concat(await studentEvents(id));
  }
  return { name: `VisaFlow — ${u.firstName} ${u.lastName}`, events };
}

// Mint or rotate the per-user feed token. Rotating revokes any external
// calendar subscriptions tied to the previous token.
router.post("/me/calendar/feed-token", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  const token = randomBytes(24).toString("base64url");
  await db.update(usersTable).set({ calendarFeedToken: token }).where(eq(usersTable.id, u.id));
  const base = process.env.APP_URL?.replace(/\/+$/, "") ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
  res.json({
    token,
    httpsUrl: `${base}/api/calendar/feed/${token}.ics`,
    webcalUrl: `${base.replace(/^https?:/, "webcal:")}/api/calendar/feed/${token}.ics`,
  });
});

// Public, unauthenticated subscription feed. External calendar clients
// (Google / Outlook / Apple) cannot maintain Clerk session cookies, so
// access is bearer-by-token: the token IS the access credential. Token is
// rotated by the user via POST /me/calendar/feed-token to revoke any
// existing subscriptions.
router.get("/calendar/feed/:token.ics", async (req, res) => {
  const tok = req.params.token;
  if (!tok || tok.length < 16) {
    res.status(400).type("text/plain").send("invalid token");
    return;
  }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.calendarFeedToken, tok));
  if (!u) {
    res.status(404).type("text/plain").send("feed not found");
    return;
  }
  const { name, events } = await eventsForUser({
    id: u.id,
    role: u.role,
    tenantId: u.tenantId,
    firstName: u.firstName,
    lastName: u.lastName,
  });
  const ics = buildIcs(name, events);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(ics);
});

// ICS feed for the current user (advisor sees all assigned students,
// student sees their own dossier).
router.get("/me/calendar.ics", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  const isStaffRole = isStaff(u);
  let studentIds: number[] = [];
  if (u.role === "student") {
    const mine = await db.select().from(studentsTable).where(eq(studentsTable.userId, u.id));
    studentIds = mine.map((s) => s.id);
  } else if (isStaffRole) {
    const filter = u.role === "advisor"
      ? eq(studentsTable.advisorId, u.id)
      : u.role === "reviewer"
        ? eq(studentsTable.reviewerId, u.id)
        : undefined;
    const tenantFilter = u.role === "superadmin" ? undefined : eq(studentsTable.tenantId, u.tenantId ?? 1);
    const where = filter && tenantFilter ? and(filter, tenantFilter) : (filter ?? tenantFilter);
    const rows = where
      ? await db.select({ id: studentsTable.id }).from(studentsTable).where(where)
      : await db.select({ id: studentsTable.id }).from(studentsTable);
    studentIds = rows.map((r) => r.id);
  }

  let events: IcsEvent[] = [];
  for (const id of studentIds) {
    events = events.concat(await studentEvents(id));
  }
  const ics = buildIcs(`VisaFlow — ${u.firstName} ${u.lastName}`, events);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="visaflow-me.ics"`);
  res.send(ics);
});

export default router;
