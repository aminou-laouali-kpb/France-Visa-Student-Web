import { db, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type DocumentPrecheckSeverity = "error" | "warning";

export type DocumentPrecheckWarning = {
  code: string;
  severity: DocumentPrecheckSeverity;
  message: string;
};

type DocRow = typeof documentsTable.$inferSelect;

const CONSULAR_REQUIRED_CATEGORIES = [
  "lettre_admission",
  "passeport",
  "test_langue",
  "justificatif_financier",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  lettre_admission: "Lettre d'admission",
  passeport: "Passeport",
  test_langue: "Test de langue",
  justificatif_financier: "Justificatif financier",
};

const PASSPORT_EXPIRY_WARN_DAYS = 90;

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

function latestInCategory(docs: DocRow[], category: string): DocRow | null {
  const inCat = docs.filter((d) => d.category === category);
  if (inCat.length === 0) return null;
  return inCat.reduce((a, b) => (b.version > a.version ? b : a));
}

export async function precheckStudentDocuments(
  studentId: number,
): Promise<DocumentPrecheckWarning[]> {
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.studentId, studentId));

  const warnings: DocumentPrecheckWarning[] = [];

  for (const category of CONSULAR_REQUIRED_CATEGORIES) {
    const label = CATEGORY_LABELS[category] ?? category;
    const latest = latestInCategory(docs, category);

    if (!latest || latest.status === "missing") {
      warnings.push({
        code: `DOC_MISSING_${category.toUpperCase()}`,
        severity: "error",
        message: `${label} manquant(e).`,
      });
      continue;
    }

    if (category === "lettre_admission" && latest.status === "rejected") {
      warnings.push({
        code: "DOC_REJECTED_LETTRE_ADMISSION",
        severity: "error",
        message: `${label} rejetée — veuillez téléverser une nouvelle version.`,
      });
    }
  }

  for (const d of docs) {
    if (d.status !== "rejected") continue;
    if (d.category === "lettre_admission") continue;
    warnings.push({
      code: `DOC_REJECTED_${d.category.toUpperCase()}`,
      severity: "error",
      message: `Document rejeté : « ${d.name} ».`,
    });
  }

  const passport = latestInCategory(docs, "passeport");
  const expiryIso = normalizeExpiryDate(passport?.expiryDate ?? null);
  if (expiryIso) {
    const days = daysUntilExpiry(expiryIso);
    if (days < 0) {
      warnings.push({
        code: "PASSPORT_EXPIRED",
        severity: "error",
        message: `Passeport expiré le ${expiryIso}.`,
      });
    } else if (days <= PASSPORT_EXPIRY_WARN_DAYS) {
      warnings.push({
        code: "PASSPORT_EXPIRING_SOON",
        severity: "warning",
        message: `Passeport expire dans ${days} jour(s) (${expiryIso}).`,
      });
    }
  }

  return warnings;
}
