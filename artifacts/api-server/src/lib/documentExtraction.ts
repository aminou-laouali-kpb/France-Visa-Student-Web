import { db, documentsTable, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { vision, isGroqConfigured } from "@workspace/ai";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";
import { runDocumentFreshnessPrecheck } from "./documentPrecheck";

const KNOWN_CATEGORIES = [
  "passeport",
  "piece_identite",
  "diplome",
  "releve_notes",
  "test_langue",
  "lettre_admission",
  "attestation_campus_france",
  "justificatif_financier",
  "avi",
  "justificatif_hebergement",
  "assurance",
  "billet_avion",
  "autre",
] as const;

const ExtractionSchema = z.object({
  classification: z.object({
    category: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().optional(),
  }),
  fields: z
    .object({
      documentNumber: z.string().nullable().optional(),
      mrz: z.string().nullable().optional(),
      firstName: z.string().nullable().optional(),
      lastName: z.string().nullable().optional(),
      fullName: z.string().nullable().optional(),
      dateOfBirth: z.string().nullable().optional(),
      placeOfBirth: z.string().nullable().optional(),
      nationality: z.string().nullable().optional(),
      sex: z.string().nullable().optional(),
      issueDate: z.string().nullable().optional(),
      expiryDate: z.string().nullable().optional(),
      issuingCountry: z.string().nullable().optional(),
      issuingAuthority: z.string().nullable().optional(),
      diplomaType: z.string().nullable().optional(),
      institution: z.string().nullable().optional(),
      gpa: z.string().nullable().optional(),
      bankBalanceEur: z.number().nullable().optional(),
      bankName: z.string().nullable().optional(),
      languageTest: z.string().nullable().optional(),
      languageScore: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      summary: z.string().nullable().optional(),
    })
    .default({}),
  warnings: z.array(z.string()).default([]),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;

const PROMPT = `You analyse identity, education and financial documents for a French student visa platform.

Return ONLY a JSON object with this exact shape:
{
  "classification": {
    "category": one of [${KNOWN_CATEGORIES.join(", ")}],
    "confidence": number 0-1,
    "reasoning": short string
  },
  "fields": {
    "documentNumber": string|null,
    "mrz": string|null,
    "firstName": string|null,
    "lastName": string|null,
    "fullName": string|null,
    "dateOfBirth": "YYYY-MM-DD"|null,
    "placeOfBirth": string|null,
    "nationality": ISO-3166 alpha-2 or country name|null,
    "sex": "M"|"F"|"X"|null,
    "issueDate": "YYYY-MM-DD"|null,
    "expiryDate": "YYYY-MM-DD"|null,
    "issuingCountry": string|null,
    "issuingAuthority": string|null,
    "diplomaType": string|null,
    "institution": string|null,
    "gpa": string|null,
    "bankBalanceEur": number|null,
    "bankName": string|null,
    "languageTest": "TCF"|"TEF"|"DELF"|"DALF"|"IELTS"|"TOEFL"|null,
    "languageScore": string|null,
    "address": string|null,
    "summary": short string|null
  },
  "warnings": string[]
}

Rules:
- All dates MUST be ISO YYYY-MM-DD. If only month/year visible, use day 01.
- Use null for any field you cannot read with reasonable confidence.
- Set classification.confidence < 0.6 if the document is blurry, partial, or you are unsure of the category.
- For passports, expiryDate is the passport expiry. For bank attestations, expiryDate is the document validity end (typically 3 months from issue).
- bankBalanceEur should be the EUR-equivalent balance. If statement is in another currency, leave null and put the original amount in summary.
- Do not invent data. Do not include keys outside the schema.
- Respond with raw JSON only, no markdown, no commentary.`;

const MAX_BYTES_FOR_AI = 8 * 1024 * 1024; // Groq limit; skip larger files
const SUPPORTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const storage = new ObjectStorageService();

async function fetchFileBase64(
  objectPath: string,
): Promise<{ b64: string; mime: string; size: number } | null> {
  const file = await storage.getObjectEntityFile(objectPath);
  const [meta] = await file.getMetadata();
  const mime = (meta.contentType as string | undefined) ?? "application/octet-stream";
  const sizeNum =
    typeof meta.size === "string" ? Number(meta.size) : (meta.size as number | undefined);
  const size = Number.isFinite(sizeNum) ? (sizeNum as number) : 0;
  if (size > MAX_BYTES_FOR_AI) return null;
  if (!SUPPORTED_MIME.has(mime)) return null;
  const [buf] = await file.download();
  return { b64: buf.toString("base64"), mime, size };
}

const MAX_ATTEMPTS = 3;

export async function runDocumentExtraction(
  documentId: number,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, documentId));
  if (!doc) return { ok: false, error: "document not found" };

  if (!isGroqConfigured()) {
    await db
      .update(documentsTable)
      .set({
        extractionStatus: "skipped",
        extractionError: "AI not configured (GROQ_API_KEY missing)",
        extractedAt: new Date(),
      })
      .where(eq(documentsTable.id, documentId));
    return { ok: false, skipped: true };
  }

  await db
    .update(documentsTable)
    .set({
      extractionStatus: "processing",
      extractionAttempts: (doc.extractionAttempts ?? 0) + 1,
      extractionError: null,
    })
    .where(eq(documentsTable.id, documentId));

  let payload: { b64: string; mime: string; size: number } | null = null;
  try {
    payload = await fetchFileBase64(doc.objectPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(documentsTable)
      .set({
        extractionStatus: "failed",
        extractionError: `fetch failed: ${message}`,
        extractedAt: new Date(),
      })
      .where(eq(documentsTable.id, documentId));
    return { ok: false, error: message };
  }

  if (!payload) {
    await db
      .update(documentsTable)
      .set({
        extractionStatus: "skipped",
        extractionError:
          "Unsupported format for AI extraction (PDF or >8MB). Use JPG/PNG/WEBP/HEIC.",
        extractedAt: new Date(),
      })
      .where(eq(documentsTable.id, documentId));
    return { ok: true, skipped: true };
  }

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await vision({
        ctx: {
          feature: "document.extraction",
          studentId: doc.studentId,
        },
        prompt: PROMPT,
        images: [{ base64: payload.b64, mimeType: payload.mime }],
        jsonSchema: ExtractionSchema,
        maxTokens: 1024,
        metadata: { documentId, category: doc.category, attempt },
      });
      const data = result.content;
      const fields = data.fields ?? {};
      const cls = KNOWN_CATEGORIES.includes(
        data.classification.category as (typeof KNOWN_CATEGORIES)[number],
      )
        ? data.classification.category
        : "autre";
      const expiry = sanitizeDate(fields.expiryDate ?? null);
      const dob = sanitizeDate(fields.dateOfBirth ?? null);
      const issueDate = sanitizeDate(fields.issueDate ?? null);
      const mergedExtracted: Record<string, unknown> = { ...(data as unknown as Record<string, unknown>), issueDate };
      await db
        .update(documentsTable)
        .set({
          extractionStatus: "done",
          extractedData: mergedExtracted,
          aiCategory: cls,
          aiConfidence: data.classification.confidence.toFixed(3),
          expiryDate: expiry,
          extractedDob: dob,
          extractedFirstName: nullIfBlank(fields.firstName ?? null),
          extractedLastName: nullIfBlank(fields.lastName ?? null),
          extractionError: null,
          extractedAt: new Date(),
        })
        .where(eq(documentsTable.id, documentId));
      const [updated] = await db.select().from(documentsTable).where(eq(documentsTable.id, documentId));
      if (updated) { const freshness = runDocumentFreshnessPrecheck(updated); if (freshness.length > 0) { await db.update(documentsTable).set({ extractedData: { ...mergedExtracted, precheckWarnings: freshness } }).where(eq(documentsTable.id, documentId)); } }
      return { ok: true };
    } catch (err) {
      lastErr = err;
      logger.warn(
        { err, documentId, attempt },
        "document extraction attempt failed",
      );
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * Math.pow(2, attempt - 1));
      }
    }
  }

  const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
  await db
    .update(documentsTable)
    .set({
      extractionStatus: "failed",
      extractionError: message.slice(0, 500),
      extractedAt: new Date(),
    })
    .where(eq(documentsTable.id, documentId));
  return { ok: false, error: message };
}

export function enqueueDocumentExtraction(documentId: number): void {
  setImmediate(() => {
    runDocumentExtraction(documentId).catch((err) => {
      logger.error({ err, documentId }, "background document extraction crashed");
    });
  });
}

function sanitizeDate(s: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function nullIfBlank(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Validation helpers used by readiness endpoint and UI ────────────────────

export const DOCUMENT_EXPIRY_SOON_DAYS = 183; // ~6 months
const SOON_DAYS = DOCUMENT_EXPIRY_SOON_DAYS;

export interface DocumentValidationFlags {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
  nameMismatch: boolean;
  dobMismatch: boolean;
  classificationMismatch: boolean;
  lowConfidence: boolean;
}

export function computeDocumentFlags(
  doc: typeof documentsTable.$inferSelect,
  student: { firstName: string; lastName: string; dateOfBirth: string | null },
): DocumentValidationFlags {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let daysUntilExpiry: number | null = null;
  if (doc.expiryDate) {
    const exp = new Date(`${doc.expiryDate}T00:00:00Z`);
    daysUntilExpiry = Math.floor(
      (exp.getTime() - today.getTime()) / (24 * 3600 * 1000),
    );
  }
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const isExpiringSoon =
    daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= SOON_DAYS;

  const norm = (s: string | null | undefined) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");

  // Name match: only flag for ID-like documents where we have at least one name field
  const isIdLike = ["passeport", "piece_identite"].includes(doc.category);
  let nameMismatch = false;
  if (isIdLike && (doc.extractedFirstName || doc.extractedLastName)) {
    const first = norm(doc.extractedFirstName);
    const last = norm(doc.extractedLastName);
    const studentFirst = norm(student.firstName);
    const studentLast = norm(student.lastName);
    const firstOk = !first || studentFirst.includes(first) || first.includes(studentFirst);
    const lastOk = !last || studentLast.includes(last) || last.includes(studentLast);
    nameMismatch = !(firstOk && lastOk);
  }

  let dobMismatch = false;
  if (isIdLike && doc.extractedDob && student.dateOfBirth) {
    dobMismatch = doc.extractedDob !== student.dateOfBirth;
  }

  const classificationMismatch =
    doc.aiCategory !== null &&
    doc.aiCategory !== doc.category &&
    Number(doc.aiConfidence ?? 0) >= 0.7;

  const lowConfidence =
    doc.aiCategory !== null && Number(doc.aiConfidence ?? 0) < 0.6;

  return {
    isExpired,
    isExpiringSoon,
    daysUntilExpiry,
    nameMismatch,
    dobMismatch,
    classificationMismatch,
    lowConfidence,
  };
}

export async function loadStudentForFlags(studentId: number): Promise<{
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
} | null> {
  const [s] = await db
    .select({
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      dateOfBirth: studentsTable.dateOfBirth,
    })
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  return s ?? null;
}
