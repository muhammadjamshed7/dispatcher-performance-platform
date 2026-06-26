-- Add optional carrier notes field used by carrier create/update UI.
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "notes" TEXT;
