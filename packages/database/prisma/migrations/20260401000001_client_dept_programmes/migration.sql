-- Add programmes array to client_departments
-- Values: "NQAS" (default), "LAQSHYA", "MUSQAN"
ALTER TABLE "client_departments"
    ADD COLUMN IF NOT EXISTS "programmes" TEXT[] NOT NULL DEFAULT ARRAY['NQAS']::TEXT[];

-- Seed MusQan departments
UPDATE "client_departments"
    SET "programmes" = ARRAY['NQAS', 'MUSQAN']
    WHERE "code" IN ('PAED_WARD', 'PAED_OPD');
