import { motifFlagId, type VisaRefusalMotifCode, VISA_REFUSAL_MOTIF_CODES } from "@workspace/db";

type DocRow = { category: string; status: string; expiryDate?: string | Date | null };

const DOC = {
  insurance: "assurance",
  financial: "justificatif_financier",
  campusFrance: "attestation_campus_france",
  passport: "passeport",
} as const;

function ok(d: DocRow[], c: string) {
  return d.some((x) => x.category === c && x.status === "validated");
}

function miss(d: DocRow[], c: string) {
  const r = d.find((x) => x.category === c);
  return !r || r.status === "missing";
}

function stale(d: DocRow[]) {
  const n = new Date();
  return d.some((x) => {
    if (!x.expiryDate) return false;
    const e = new Date(x.expiryDate);
    return !isNaN(e.getTime()) && e < n;
  });
}

export function computeRefusalMotifFlags(i: {
  docs: DocRow[];
  missingCampusFrance: boolean;
  hasVisaRefusalHistory: boolean;
  financialProofCount?: number;
}): VisaRefusalMotifCode[] {
  const f = new Set<VisaRefusalMotifCode>();
  if (i.hasVisaRefusalHistory || miss(i.docs, DOC.passport)) f.add("1");
  if (!ok(i.docs, DOC.financial) && (i.financialProofCount ?? 0) < 1) f.add("2");
  if (i.missingCampusFrance || !ok(i.docs, DOC.campusFrance)) f.add("6");
  if (miss(i.docs, DOC.insurance) || !ok(i.docs, DOC.insurance)) f.add("3");
  if (stale(i.docs)) f.add("7");
  return VISA_REFUSAL_MOTIF_CODES.filter((c) => f.has(c));
}

export function refusalMotifFlagIds(c: VisaRefusalMotifCode[]): string[] {
  return c.map(motifFlagId);
}
