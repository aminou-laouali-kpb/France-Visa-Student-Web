export const VISA_REFUSAL_MOTIF_CODES = ["1","2","3","4","5","6","7"] as const;
export type VisaRefusalMotifCode = (typeof VISA_REFUSAL_MOTIF_CODES)[number];
export function motifFlagId(code: VisaRefusalMotifCode): string { return `motif_${code}`; }
