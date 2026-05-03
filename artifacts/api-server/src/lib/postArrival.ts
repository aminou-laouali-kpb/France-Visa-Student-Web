import { db, postArrivalStepsTable, studentsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Canonical post-arrival workflow. Generated when a student transitions to
// "visa_obtained" — drives the dashboard "Après l'arrivée" section, the
// dedicated student tab, and the 60d titre-renewal reminder. The list is
// authoritative: codes are stable contracts referenced by reminder code,
// while labels are user-facing French strings.
export interface PostArrivalTemplateStep {
  code: string;
  label: string;
  description: string;
  // Whether this step only applies to VLS-TS holders (the >3-month visa
  // that requires online ANEF validation within 3 months of arrival).
  vlsTsOnly?: boolean;
  // Default offset in days from arrival used to seed `dueDate` when the
  // student has an `arrivalDate` set.
  daysFromArrival?: number;
}

export const POST_ARRIVAL_TEMPLATE: PostArrivalTemplateStep[] = [
  {
    code: "anef_validation",
    label: "Validation VLS-TS sur l'ANEF",
    description:
      "Valider votre visa long séjour sur administration-etrangers-en-france.interieur.gouv.fr dans les 3 mois suivant l'arrivée.",
    vlsTsOnly: true,
    daysFromArrival: 30,
  },
  {
    code: "ofii_medical",
    label: "Visite médicale OFII",
    description:
      "Convocation à la visite médicale OFII reçue après validation ANEF — obligatoire pour la régularité du séjour.",
    vlsTsOnly: true,
    daysFromArrival: 60,
  },
  {
    code: "caf",
    label: "Demande d'aide au logement (CAF)",
    description:
      "Constituer le dossier APL/ALS auprès de la CAF dès la signature du bail.",
    daysFromArrival: 30,
  },
  {
    code: "secu_etudiante",
    label: "Inscription Sécurité sociale étudiante",
    description:
      "Affiliation au régime étudiant via etudiant-etranger.ameli.fr (gratuite, obligatoire).",
    daysFromArrival: 14,
  },
  {
    code: "bank",
    label: "Ouverture d'un compte bancaire",
    description:
      "Ouvrir un compte courant français pour percevoir bourses, APL et payer le loyer.",
    daysFromArrival: 14,
  },
  {
    code: "titre_renewal",
    label: "Renouvellement du titre de séjour",
    description:
      "Initier le renouvellement 2 à 4 mois avant l'expiration du titre de séjour.",
    vlsTsOnly: true,
  },
];

// Idempotently provision/reconcile the post-arrival workflow for a student.
//
// Reconciliation rules:
//   • Missing rows are inserted (concurrency-safe via the
//     post_arrival_student_code_uq unique index + onConflictDoNothing).
//   • If the student now holds a VLS-T visa, previously-provisioned
//     vlsTsOnly steps that are still untouched (status = "not_started"
//     and no notes) are removed so the workflow matches the new visa
//     type. Steps the student has already started/completed/annotated
//     are NEVER deleted to preserve user data.
//   • For non-completed rows, `dueDate` is recomputed from the current
//     `arrivalDate` so a corrected arrival date propagates to existing
//     timelines.
//
// Returns the number of rows added.
export async function provisionPostArrivalSteps(
  studentId: number,
  opts: { visaType: string | null | undefined; arrivalDate: string | null | undefined },
): Promise<number> {
  const existing = await db
    .select()
    .from(postArrivalStepsTable)
    .where(eq(postArrivalStepsTable.studentId, studentId));
  const presentCodes = new Set(existing.map((r) => r.code));
  const isVlsT = opts.visaType === "vls_t";
  const arrival = opts.arrivalDate ? new Date(opts.arrivalDate) : null;
  const arrivalValid = arrival && !Number.isNaN(arrival.getTime()) ? arrival : null;
  const dueFor = (tpl: PostArrivalTemplateStep): string | null => {
    if (!arrivalValid || typeof tpl.daysFromArrival !== "number") return null;
    const d = new Date(arrivalValid);
    d.setDate(d.getDate() + tpl.daysFromArrival);
    return d.toISOString().slice(0, 10);
  };
  const tplByCode = new Map(POST_ARRIVAL_TEMPLATE.map((t) => [t.code, t]));

  // 1. Reconcile existing rows: drop now-inapplicable vlsTsOnly steps
  //    (only when untouched), refresh dueDate for active steps.
  for (const row of existing) {
    const tpl = tplByCode.get(row.code);
    if (!tpl) continue;
    if (tpl.vlsTsOnly && isVlsT) {
      const untouched =
        row.status === "not_started" && !row.notes && !row.completedAt;
      if (untouched) {
        await db
          .delete(postArrivalStepsTable)
          .where(eq(postArrivalStepsTable.id, row.id));
        presentCodes.delete(row.code);
      }
      continue;
    }
    const newDue = dueFor(tpl);
    const isCompleted =
      row.status === "validated" || row.status === "submitted";
    if (!isCompleted && newDue !== row.dueDate) {
      await db
        .update(postArrivalStepsTable)
        .set({ dueDate: newDue, updatedAt: new Date() })
        .where(eq(postArrivalStepsTable.id, row.id));
    }
  }

  // 2. Insert missing rows. onConflictDoNothing closes the
  //    select-then-insert race against parallel provision calls.
  let added = 0;
  let order = existing.reduce((mx, r) => Math.max(mx, r.order), -1) + 1;
  for (const tpl of POST_ARRIVAL_TEMPLATE) {
    if (presentCodes.has(tpl.code)) continue;
    if (tpl.vlsTsOnly && isVlsT) continue;
    // Bare onConflictDoNothing catches the
    // post_arrival_student_code_uq violation under concurrent provision.
    const result = await db
      .insert(postArrivalStepsTable)
      .values({
        studentId,
        code: tpl.code,
        label: tpl.label,
        description: tpl.description,
        order: order++,
        dueDate: dueFor(tpl),
      })
      .onConflictDoNothing()
      .returning({ id: postArrivalStepsTable.id });
    if (result.length > 0) added++;
  }
  return added;
}

// Reminder sweep — idempotent. We dedupe by (userId, type) where the
// notification `type` encodes the reminder code (e.g.
// "reminder.arrival.7d:1234"). Any existing notification with the same
// type for the same user means the reminder already fired, so we skip.
//
// Triggers:
//   • Pre-arrival: 14 / 7 / 1 day(s) before `arrivalDate`.
//   • Pre-renewal: 60 days before `titreExpiryDate`.
//
// Called lazily on dashboard fetch — no background worker needed for the
// single-tenant deployment shape we're targeting.
export async function runReminderSweepForStudent(studentId: number): Promise<number> {
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  if (!student) return 0;
  const recipients = new Set<number>();
  if (student.userId) recipients.add(student.userId);
  if (student.advisorId) recipients.add(student.advisorId);
  if (recipients.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysBetween = (target: Date) => {
    const t = new Date(target);
    t.setHours(0, 0, 0, 0);
    return Math.round((t.getTime() - today.getTime()) / 86_400_000);
  };

  const firings: { type: string; title: string; message: string }[] = [];
  if (student.arrivalDate) {
    const arrival = new Date(student.arrivalDate);
    if (!Number.isNaN(arrival.getTime())) {
      const days = daysBetween(arrival);
      for (const d of [14, 7, 1]) {
        if (days === d) {
          firings.push({
            type: `reminder.arrival.${d}d:${student.id}`,
            title: `Arrivée en France dans ${d} jour${d > 1 ? "s" : ""}`,
            message: `Préparez votre dossier d'arrivée : VLS-TS, OFII, CAF, banque. Arrivée prévue le ${arrival.toLocaleDateString("fr-FR")}.`,
          });
        }
      }
    }
  }
  if (student.titreExpiryDate) {
    const expiry = new Date(student.titreExpiryDate);
    if (!Number.isNaN(expiry.getTime())) {
      const days = daysBetween(expiry);
      if (days === 60) {
        firings.push({
          type: `reminder.titre.60d:${student.id}`,
          title: "Renouvellement du titre de séjour",
          message: `Votre titre de séjour expire le ${expiry.toLocaleDateString("fr-FR")}. Initiez le renouvellement dès maintenant (délai de 2 à 4 mois).`,
        });
      }
    }
  }
  if (firings.length === 0) return 0;

  // Concurrency-safe dedup: the partial unique index
  // notifications_reminder_dedup_uq on (user_id, type) WHERE type LIKE
  // 'reminder.%' guarantees we never insert two reminders of the same
  // type for the same recipient, even under parallel dashboard fetches.
  const userIds = Array.from(recipients);
  let inserted = 0;
  for (const f of firings) {
    for (const uid of userIds) {
      // Bare onConflictDoNothing catches the partial unique index
      // notifications_reminder_dedup_uq violation; reminder types always
      // start with "reminder." so the partial predicate matches.
      const result = await db
        .insert(notificationsTable)
        .values({
          userId: uid,
          studentId: student.id,
          title: f.title,
          message: f.message,
          type: f.type,
        })
        .onConflictDoNothing()
        .returning({ id: notificationsTable.id });
      if (result.length > 0) inserted++;
    }
  }
  return inserted;
}
