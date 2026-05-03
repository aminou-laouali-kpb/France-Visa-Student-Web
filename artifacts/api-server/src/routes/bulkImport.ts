import { Router, type IRouter } from "express";
import {
  db,
  studentsTable,
  countriesTable,
  schoolsTable,
  programsTable,
} from "@workspace/db";
import { and, eq, ilike } from "drizzle-orm";
import { requireAuth, isAdmin } from "../middlewares/auth";
import { z } from "zod/v4";
import * as XLSX from "xlsx";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Lightweight CSV parser (RFC 4180 subset). Handles quoted fields with
// embedded commas / newlines / doubled quotes. Sufficient for cohort
// imports — for richer formats (XLSX, ODS) we delegate to SheetJS.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (c === "\r") {
        // skip
      } else {
        cur += c;
      }
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

interface ImportRow {
  rowIndex: number;
  raw: Record<string, string>;
  parsed: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    nationalityCode?: string;
    intakeDate?: string;
    countryName?: string;
    schoolName?: string;
    programName?: string;
  };
  errors: string[];
  warnings: string[];
  resolved: {
    countryId?: number | null;
    schoolId?: number | null;
    programId?: number | null;
    duplicate?: boolean;
  };
}

const HEADER_ALIASES: Record<string, keyof ImportRow["parsed"]> = {
  "first name": "firstName",
  "firstname": "firstName",
  "prenom": "firstName",
  "prénom": "firstName",
  "last name": "lastName",
  "lastname": "lastName",
  "nom": "lastName",
  "email": "email",
  "courriel": "email",
  "phone": "phone",
  "telephone": "phone",
  "téléphone": "phone",
  "nationality": "nationalityCode",
  "nationalité": "nationalityCode",
  "country code": "nationalityCode",
  "intake": "intakeDate",
  "intake date": "intakeDate",
  "rentree": "intakeDate",
  "rentrée": "intakeDate",
  "country": "countryName",
  "pays": "countryName",
  "school": "schoolName",
  "ecole": "schoolName",
  "école": "schoolName",
  "program": "programName",
  "programme": "programName",
};

function normalizeHeader(h: string): keyof ImportRow["parsed"] | null {
  const k = h.trim().toLowerCase();
  return HEADER_ALIASES[k] ?? null;
}

async function rowsFromBody(body: {
  format: "csv" | "xlsx";
  content: string;
}): Promise<string[][]> {
  if (body.format === "csv") {
    return parseCsv(body.content);
  }
  // xlsx: base64-encoded workbook
  const buf = Buffer.from(body.content, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
}

async function buildPreview(
  rawRows: string[][],
  tenantId: number,
): Promise<{
  headers: string[];
  rows: ImportRow[];
}> {
  if (rawRows.length === 0) return { headers: [], rows: [] };
  const headers = rawRows[0].map((h) => h.trim());
  const mapped = headers.map((h) => normalizeHeader(h));
  const rows: ImportRow[] = [];

  // Pre-fetch reference tables once.
  const allCountries = await db.select().from(countriesTable);
  const allSchools = await db.select().from(schoolsTable);
  const allPrograms = await db.select().from(programsTable);

  for (let i = 1; i < rawRows.length; i++) {
    const cells = rawRows[i];
    const raw: Record<string, string> = {};
    const parsed: ImportRow["parsed"] = {};
    headers.forEach((h, j) => {
      raw[h] = (cells[j] ?? "").toString().trim();
    });
    mapped.forEach((key, j) => {
      if (key) parsed[key] = (cells[j] ?? "").toString().trim() || undefined;
    });

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!parsed.firstName) errors.push("firstName manquant");
    if (!parsed.lastName) errors.push("lastName manquant");
    if (!parsed.email) errors.push("email manquant");
    else if (!/^\S+@\S+\.\S+$/.test(parsed.email)) errors.push("email invalide");

    let countryId: number | null = null;
    if (parsed.countryName) {
      const c = allCountries.find(
        (x) =>
          x.name.toLowerCase() === parsed.countryName!.toLowerCase() ||
          x.code.toLowerCase() === parsed.countryName!.toLowerCase(),
      );
      if (c) countryId = c.id;
      else warnings.push(`pays "${parsed.countryName}" introuvable`);
    }
    let schoolId: number | null = null;
    if (parsed.schoolName) {
      const s = allSchools.find((x) => x.name.toLowerCase() === parsed.schoolName!.toLowerCase());
      if (s) schoolId = s.id;
      else warnings.push(`école "${parsed.schoolName}" introuvable`);
    }
    let programId: number | null = null;
    if (parsed.programName) {
      const p = allPrograms.find(
        (x) =>
          x.name.toLowerCase() === parsed.programName!.toLowerCase() &&
          (schoolId == null || x.schoolId === schoolId),
      );
      if (p) programId = p.id;
      else warnings.push(`programme "${parsed.programName}" introuvable`);
    }

    let duplicate = false;
    if (parsed.email) {
      // Tenant-scoped duplicate check — never reveals cross-tenant existence.
      const [existing] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(
          and(
            eq(studentsTable.tenantId, tenantId),
            ilike(studentsTable.email, parsed.email),
          ),
        );
      if (existing) {
        duplicate = true;
        warnings.push("email déjà existant — sera ignoré");
      }
    }

    rows.push({
      rowIndex: i,
      raw,
      parsed,
      errors,
      warnings,
      resolved: { countryId, schoolId, programId, duplicate },
    });
  }
  return { headers, rows };
}

const previewBodySchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  content: z.string(),
});

router.post("/admin/import/preview", requireAuth, async (req, res) => {
  const me = req.currentUser!;
  if (!isAdmin(me)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = previewBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.message });
    return;
  }
  try {
    const rawRows = await rowsFromBody(parsed.data);
    const preview = await buildPreview(rawRows, me.tenantId ?? 1);
    const totals = {
      total: preview.rows.length,
      valid: preview.rows.filter((r) => r.errors.length === 0 && !r.resolved.duplicate).length,
      withErrors: preview.rows.filter((r) => r.errors.length > 0).length,
      duplicates: preview.rows.filter((r) => r.resolved.duplicate).length,
    };
    res.json({ headers: preview.headers, rows: preview.rows, totals });
  } catch (err) {
    logger.warn({ err }, "import preview failed");
    res.status(400).json({ error: "Parse failed" });
  }
});

const commitBodySchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  content: z.string(),
  // When true, rows whose email already exists will be skipped silently.
  skipDuplicates: z.boolean().default(true),
});

router.post("/admin/import/commit", requireAuth, async (req, res) => {
  const me = req.currentUser!;
  if (!isAdmin(me)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = commitBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.message });
    return;
  }
  try {
    const tenantId = me.tenantId ?? 1;
    const rawRows = await rowsFromBody(parsed.data);
    const preview = await buildPreview(rawRows, tenantId);

    // Atomic commit: all valid (non-duplicate, error-free) rows insert in a
    // single DB transaction. If any insert throws, the entire batch is
    // rolled back so partial cohorts never end up in the database.
    const errors: Array<{ rowIndex: number; reason: string }> = [];
    const insertable = preview.rows.filter((r) => {
      if (r.errors.length > 0) {
        errors.push({ rowIndex: r.rowIndex, reason: r.errors.join(", ") });
        return false;
      }
      if (r.resolved.duplicate && parsed.data.skipDuplicates) return false;
      return true;
    });
    const skippedFromValidation =
      preview.rows.length - insertable.length - errors.length;

    let created = 0;
    try {
      await db.transaction(async (tx) => {
        for (const r of insertable) {
          await tx.insert(studentsTable).values({
            tenantId,
            firstName: r.parsed.firstName!,
            lastName: r.parsed.lastName!,
            email: r.parsed.email!,
            phone: r.parsed.phone ?? null,
            nationalityCode: r.parsed.nationalityCode ?? null,
            intakeDate: r.parsed.intakeDate ?? null,
            countryId: r.resolved.countryId ?? null,
            schoolId: r.resolved.schoolId ?? null,
            programId: r.resolved.programId ?? null,
            status: "active",
          });
          created++;
        }
      });
    } catch (err) {
      logger.warn({ err }, "import commit transaction rolled back");
      res.status(400).json({
        created: 0,
        skipped: preview.rows.length,
        errors: [
          ...errors,
          {
            rowIndex: -1,
            reason: `transaction rolled back: ${(err as Error).message}`,
          },
        ],
      });
      return;
    }
    res.json({
      created,
      skipped: skippedFromValidation + errors.length,
      errors,
    });
  } catch (err) {
    logger.warn({ err }, "import commit failed");
    res.status(400).json({ error: "Parse failed" });
  }
});

export default router;
