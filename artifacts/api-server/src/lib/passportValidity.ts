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

export interface PassportValidityWarning {
  message: string;
  requiredUntil: string;
  passportExpiry: string;
  intakeDate: string;
}

export function checkPassportValidityForIntake(
  passportExpiry: string | null | undefined,
  intakeDate: string | null | undefined,
): PassportValidityWarning | null {
  const requiredUntil = minimumPassportExpiryForIntake(intakeDate);
  const expiry = parseIsoDate(passportExpiry);
  if (!requiredUntil || !expiry || !passportExpiry || !intakeDate) return null;
  if (expiry.getTime() < requiredUntil.getTime()) {
    const until = requiredUntil.toISOString().slice(0, 10);
    return {
      message: `Passeport : validité insuffisante (expire le ${passportExpiry}, requis au moins jusqu'au ${until} — rentrée + 3 mois).`,
      requiredUntil: until,
      passportExpiry,
      intakeDate,
    };
  }
  return null;
}

export function isPassportTooShortForIntake(
  passportExpiry: string | null | undefined,
  intakeDate: string | null | undefined,
): boolean {
  return checkPassportValidityForIntake(passportExpiry, intakeDate) !== null;
}
