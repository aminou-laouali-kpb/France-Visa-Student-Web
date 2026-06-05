export const PASSPORT_VALIDITY_MONTHS_AFTER_INTAKE = 3;

export function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
}

export function addMonthsUtc(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCMonth(out.getUTCMonth() + months);
  if (out.getUTCDate() !== day) out.setUTCDate(0);
  return out;
}

export function minimumPassportExpiryForIntake(
  intakeDate: string | null | undefined,
): Date | null {
  const intake = parseIsoDate(intakeDate);
  if (!intake) return null;
  return addMonthsUtc(intake, PASSPORT_VALIDITY_MONTHS_AFTER_INTAKE);
}

export function isPassportTooShortForIntake(
  passportExpiry: string | null | undefined,
  intakeDate: string | null | undefined,
): boolean {
  const requiredUntil = minimumPassportExpiryForIntake(intakeDate);
  const expiry = parseIsoDate(passportExpiry);
  if (!requiredUntil || !expiry) return false;
  return expiry.getTime() < requiredUntil.getTime();
}
