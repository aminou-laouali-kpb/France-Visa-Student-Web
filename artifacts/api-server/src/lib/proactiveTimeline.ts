import {
  db,
  studentsTable,
  studentStepsTable,
  documentsTable,
  appointmentsTable,
  intakeCalendarEntriesTable,
  type StudentStep,
} from "@workspace/db";
import { eq, and, gte, asc } from "drizzle-orm";
import { documentCategoryIsMissing } from "./risk";

export type MilestoneStatus = "done" | "current" | "upcoming" | "overdue" | "blocked";

export interface ProactiveMilestone {
  id: string;
  label: string;
  status: MilestoneStatus;
  dueDate: string | null;
  href: string | null;
  urgency: "low" | "medium" | "high";
  kind: "step" | "document" | "appointment" | "deadline" | "intake";
}

const DEPARTURE_OFFSET_DAYS = 30;

function stepStatusToMilestone(step: StudentStep, isCurrent: boolean): MilestoneStatus {
  if (step.status === "validated") return "done";
  if (step.status === "blocked" || step.status === "rejected") return "blocked";
  if (isCurrent || step.status === "in_progress" || step.status === "submitted") return "current";
  return "upcoming";
}

function urgencyFromDueDate(dueDate: string | null, status: MilestoneStatus): "low" | "medium" | "high" {
  if (status === "done") return "low";
  if (status === "blocked" || status === "overdue") return "high";
  if (!dueDate) return status === "current" ? "medium" : "low";
  const days = Math.floor((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return "high";
  if (days <= 14) return "high";
  if (days <= 45) return "medium";
  return "low";
}

export async function getProactiveMilestones(studentId: number): Promise<ProactiveMilestone[]> {
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) return [];

  const [steps, docs, apts] = await Promise.all([
    db
      .select()
      .from(studentStepsTable)
      .where(eq(studentStepsTable.studentId, studentId))
      .orderBy(asc(studentStepsTable.stepOrder)),
    db.select().from(documentsTable).where(eq(documentsTable.studentId, studentId)),
    db
      .select()
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.studentId, studentId),
          eq(appointmentsTable.status, "upcoming"),
        ),
      )
      .orderBy(asc(appointmentsTable.scheduledAt)),
  ]);

  const milestones: ProactiveMilestone[] = [];
  const now = new Date();
  let intakeDate: Date | null = null;
  if (student.intakeDate) {
    const parsed = new Date(student.intakeDate);
    if (!isNaN(parsed.getTime())) intakeDate = parsed;
  }
  const intakeIso = intakeDate ? intakeDate.toISOString().slice(0, 10) : null;
  const departureIso = intakeDate
    ? new Date(intakeDate.getTime() - DEPARTURE_OFFSET_DAYS * 86400000).toISOString().slice(0, 10)
    : null;

  if (intakeIso) {
    const daysToIntake = Math.floor((intakeDate!.getTime() - now.getTime()) / 86400000);
    const st: MilestoneStatus =
      student.status === "visa_obtained"
        ? "done"
        : daysToIntake < 0
          ? "overdue"
          : daysToIntake <= 60
            ? "current"
            : "upcoming";
    milestones.push({
      id: "intake-rentree",
      label: `Rentrée prévue (${intakeIso})`,
      status: st,
      dueDate: intakeIso,
      href: "/student",
      urgency: urgencyFromDueDate(intakeIso, st),
      kind: "intake",
    });
    if (departureIso) {
      milestones.push({
        id: "departure-target",
        label: `Départ conseillé avant la rentrée (~${departureIso})`,
        status: st === "done" ? "done" : st,
        dueDate: departureIso,
        href: "/student/appointments",
        urgency: urgencyFromDueDate(departureIso, st),
        kind: "intake",
      });
    }
  }

  const code = student.nationalityCode?.trim();
  if (code) {
    const today = now.toISOString().slice(0, 10);
    const calendarRows = await db
      .select()
      .from(intakeCalendarEntriesTable)
      .where(
        and(
          eq(intakeCalendarEntriesTable.nationalityCode, code),
          gte(intakeCalendarEntriesTable.windowEnd, today),
        ),
      )
      .orderBy(asc(intakeCalendarEntriesTable.windowEnd))
      .limit(4);
    for (const row of calendarRows) {
      const due = row.windowEnd;
      const days = Math.floor((new Date(due).getTime() - now.getTime()) / 86400000);
      const st: MilestoneStatus = days < 0 ? "overdue" : days <= 21 ? "current" : "upcoming";
      milestones.push({
        id: `cal-${row.id}`,
        label: row.label,
        status: st,
        dueDate: due,
        href: "/student",
        urgency: urgencyFromDueDate(due, st),
        kind: "deadline",
      });
    }
  }

  const criticalDocs: { category: string; label: string }[] = [
    { category: "lettre_admission", label: "Lettre d'admission" },
    { category: "justificatif_financier", label: "Justificatif financier" },
    { category: "passeport", label: "Passeport valide" },
  ];
  for (const { category, label } of criticalDocs) {
    if (!documentCategoryIsMissing(docs, category)) continue;
    milestones.push({
      id: `doc-${category}`,
      label: `Téléverser : ${label}`,
      status: "current",
      dueDate: departureIso ?? intakeIso,
      href: "/student/documents",
      urgency: "high",
      kind: "document",
    });
  }

  const currentIdx = steps.findIndex((s) => s.status !== "validated");
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const isCurrent = i === currentIdx;
    const st = stepStatusToMilestone(step, isCurrent);
    if (st === "done" && i < steps.length - 3) continue;
    milestones.push({
      id: `step-${step.id}`,
      label: step.stepName,
      status: st,
      dueDate: isCurrent ? departureIso ?? intakeIso : null,
      href: "/student/steps",
      urgency: urgencyFromDueDate(isCurrent ? (departureIso ?? intakeIso) : null, st),
      kind: "step",
    });
    if (milestones.filter((m) => m.kind === "step").length >= 8) break;
  }

  for (const apt of apts.slice(0, 3)) {
    const due = apt.scheduledAt.toISOString();
    milestones.push({
      id: `apt-${apt.id}`,
      label: apt.title,
      status: "current",
      dueDate: due.slice(0, 10),
      href: "/student/appointments",
      urgency: urgencyFromDueDate(due.slice(0, 10), "current"),
      kind: "appointment",
    });
  }

  const order: Record<MilestoneStatus, number> = {
    overdue: 0,
    blocked: 1,
    current: 2,
    upcoming: 3,
    done: 4,
  };
  return milestones
    .sort((a, b) => {
      const o = order[a.status] - order[b.status];
      if (o !== 0) return o;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    })
    .slice(0, 12);
}
