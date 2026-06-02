import { db, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type DocumentPrecheckWarning = {
  code: string;
  severity: "error" | "warning";
  message: string;
};

type DocRow = typeof documentsTable.$inferSelect;

const REQUIRED_CONSULAR_CATEGORIES = [
  "lettre_admission",
  "passeport",
  "test_langue",
  "justificatif_financier",
] as const;

const PASSPORT_EXPIRY_WARN_DAYS = 90;

function latestByCategory(docs: DocRow[], category: string): DocRow | null {
  const byCategory = docs.filter((d) => d.category === category);
  if (byCategory.length === 0) return null;
  return byCategory.reduce((a, b) => (b.version > a.version ? b : a));
}

function normalizeExpiryDate(expiryDate: unknown): string | null {
  if (!expiryDate) return null;
  if (typeof expiryDate === "string") return expiryDate;
  if (expiryDate instanceof Date) return expiryDate.toISOString().slice(0, 10);
  return null;
}

function daysUntilExpiry(expiryDateIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiryDateIso}T00:00:00Z`);
  return Math.floor((expiry.getTime() - today.getTime()) / (24 * 3600 * 1000));
}

export async function precheckStudentDocuments(
  studentId: number,
): Promise<DocumentPrecheckWarning[]> {
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.studentId, studentId));

  const warnings: DocumentPrecheckWarning[] = [];

  for (const category of REQUIRED_CONSULAR_CATEGORIES) {
    const latest = latestByCategory(docs, category);
    if (!latest || latest.status === "missing") {
      warnings.push({
        code: `DOC_MISSING_${category.toUpperCase()}`,
        severity: "error",
        message: `${category} manquant.`,
      });
      continue;
    }
    if (category === "lettre_admission" && latest.status === "rejected") {
      warnings.push({
        code: "DOC_REJECTED_LETTRE_ADMISSION",
        severity: "error",
        message: "La lettre d'admission est rejetée.",
      });
    }
  }

  for (const d of docs) {
    if (d.status !== "rejected" || d.category === "lettre_admission") continue;
    warnings.push({
      code: `DOC_REJECTED_${String(d.category).toUpperCase()}`,
      severity: "error",
      message: `Document rejeté : ${d.name}.`,
    });
  }

  const passport = latestByCategory(docs, "passeport");
  const passportExpiry = normalizeExpiryDate(passport?.expiryDate ?? null);
  if (passportExpiry) {
    const days = daysUntilExpiry(passportExpiry);
    if (days < 0) {
      warnings.push({
        code: "PASSPORT_EXPIRED",
        severity: "error",
        message: `Passeport expiré le ${passportExpiry}.`,
      });
    } else if (days <= PASSPORT_EXPIRY_WARN_DAYS) {
      warnings.push({
        code: "PASSPORT_EXPIRING_SOON",
        severity: "warning",
        message: `Passeport expire dans ${days} jours (${passportExpiry}).`,
      });
    }
  }

  return warnings;
}
