CREATE TABLE "institution_assessments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "type" "AssessmentType" NOT NULL DEFAULT 'INTERNAL',
    "module" "AppModule" NOT NULL DEFAULT 'NQAS',
    "assessorNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institution_assessments_quarter_year_type_module_key"
    ON "institution_assessments"("quarter", "year", "type", "module");

CREATE INDEX "institution_assessments_createdById_idx"
    ON "institution_assessments"("createdById");

ALTER TABLE "institution_assessments"
    ADD CONSTRAINT "institution_assessments_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessments"
    ADD COLUMN "institutionAssessmentId" TEXT;

CREATE INDEX "assessments_institutionAssessmentId_idx"
    ON "assessments"("institutionAssessmentId");

ALTER TABLE "assessments"
    ADD CONSTRAINT "assessments_institutionAssessmentId_fkey"
    FOREIGN KEY ("institutionAssessmentId") REFERENCES "institution_assessments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
