-- Add pageAccess column to role_permissions
ALTER TABLE "role_permissions" ADD COLUMN "pageAccess" TEXT[] NOT NULL DEFAULT '{}';

-- Set defaults matching current hardcoded role access
UPDATE "role_permissions" SET "pageAccess" = ARRAY['dashboard','assessments','approvals','reports','users','settings'] WHERE "role" = 'ADMIN';
UPDATE "role_permissions" SET "pageAccess" = ARRAY['dashboard','assessments','approvals','reports'] WHERE "role" = 'HOD';
UPDATE "role_permissions" SET "pageAccess" = ARRAY['dashboard','assessments','reports'] WHERE "role" = 'ASSESSOR';

-- Insert missing rows in case seed hasn't run yet
INSERT INTO "role_permissions" ("role", "moduleAccess", "pageAccess", "updatedAt")
VALUES
  ('ADMIN',    ARRAY['NQAS','NABH','KAYAKALPA']::"AppModule"[], ARRAY['dashboard','assessments','approvals','reports','users','settings'], NOW()),
  ('HOD',      ARRAY['NQAS']::"AppModule"[],                    ARRAY['dashboard','assessments','approvals','reports'],                   NOW()),
  ('ASSESSOR', ARRAY['NQAS']::"AppModule"[],                    ARRAY['dashboard','assessments','reports'],                              NOW())
ON CONFLICT ("role") DO NOTHING;

-- Drop the temporary default (column is now populated)
ALTER TABLE "role_permissions" ALTER COLUMN "pageAccess" DROP DEFAULT;
