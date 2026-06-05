const THREE_MONTH_PRECHECK_CATEGORIES = new Set([
  "releve_notes",
  "justificatif_hebergement",
  "avi",
]);

const THREE_MONTH_MS = 92 * 24 * 3600 * 1000;

type DocRow = {
  category: string;
  extractedData?: unknown;
  expiryDate?: string | null;
};

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
}

function documentIssueDate(doc: DocRow): string | null {
  const data = doc.extractedData as Record<string, unknown> | null | undefined;
  if (!data) return null;
  const fields = data.fields as Record<string, unknown> | undefined;
  const fromFields =
    (fields?.issueDate as string | undefined) ??
    (data.issueDate as string | undefined);
  if (fromFields) return fromFields;
  if (doc.category === "avi") {
    return (data.aviCertificateDate as string | undefined) ?? null;
  }
  return null;
}

/** Returns an i18n key for the 3-month freshness warning, or null. */
export function checkThreeMonthRule(
  doc: DocRow,
  referenceDate: Date = new Date(),
): string | null {
  if (!THREE_MONTH_PRECHECK_CATEGORIES.has(doc.category)) return null;

  const issue = parseIsoDate(documentIssueDate(doc));
  const refMs = referenceDate.getTime();

  if (issue) {
    const ageMs = refMs - issue.getTime();
    if (ageMs > THREE_MONTH_MS) return "precheck.threeMonthStale";
    return null;
  }

  const exp = parseIsoDate(doc.expiryDate ?? null);
  if (exp && exp.getTime() < refMs) return "precheck.threeMonthExpired";

  return null;
}
