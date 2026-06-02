ALTER TABLE students ADD COLUMN IF NOT EXISTS refusal_reason_code text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS refusal_notes text;
ALTER TABLE risk_scores ADD COLUMN IF NOT EXISTS refusal_motif_flags jsonb NOT NULL DEFAULT '[]'::jsonb;
