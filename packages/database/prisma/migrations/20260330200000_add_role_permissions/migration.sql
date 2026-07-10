-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "UserRole" NOT NULL,
    "moduleAccess" "AppModule"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role")
);

-- Seed default role permissions
INSERT INTO "role_permissions" ("role", "moduleAccess", "updatedAt")
VALUES
    ('ADMIN',    ARRAY['NQAS', 'NABH', 'KAYAKALPA']::"AppModule"[], NOW()),
    ('HOD',      ARRAY['NQAS']::"AppModule"[], NOW()),
    ('ASSESSOR', ARRAY['NQAS']::"AppModule"[], NOW())
ON CONFLICT ("role") DO NOTHING;
