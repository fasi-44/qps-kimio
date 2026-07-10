-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HOD', 'ASSESSOR');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SENT_BACK');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "Quarter" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "ScoreMappingType" AS ENUM ('DIRECT', 'PROPORTIONAL', 'CONDITIONAL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('APPROVED', 'REJECTED', 'SENT_BACK');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSESSMENT_SUBMITTED', 'ASSESSMENT_APPROVED', 'ASSESSMENT_REJECTED', 'ASSESSMENT_SENT_BACK', 'ASSESSMENT_OVERDUE', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ASSESSOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "designation" TEXT,
    "department" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Hospital Name',
    "shortName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "districtBoard" TEXT,
    "accreditationBody" TEXT,
    "nabh_reg_number" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas_of_concern" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_of_concern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standards" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "areaOfConcernId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurable_elements" (
    "id" TEXT NOT NULL,
    "meRef" TEXT NOT NULL,
    "meDescription" TEXT NOT NULL,
    "checkpoint" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "isScored" BOOLEAN NOT NULL DEFAULT false,
    "assessmentMethod" TEXT,
    "meansOfVerification" TEXT,
    "order" INTEGER NOT NULL,
    "standardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurable_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pdfFileName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_sections" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "clientDepartmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_checkpoints" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 2,
    "scoreOptions" INTEGER[],
    "order" INTEGER NOT NULL,
    "clientSectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_mappings" (
    "id" TEXT NOT NULL,
    "clientCheckpointId" TEXT NOT NULL,
    "measurableElementId" TEXT,
    "scoreMappingType" "ScoreMappingType" NOT NULL DEFAULT 'DIRECT',
    "scoreMappingFormula" JSONB,
    "complianceThreshold" INTEGER NOT NULL DEFAULT 70,
    "isNa" BOOLEAN NOT NULL DEFAULT false,
    "naReason" TEXT,
    "remarks" TEXT,
    "importVersion" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "type" "AssessmentType" NOT NULL DEFAULT 'INTERNAL',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "departmentId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "assesseeName" TEXT NOT NULL,
    "assessorNames" TEXT[],
    "completedSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "totalClientScore" INTEGER NOT NULL DEFAULT 0,
    "totalNqasScore" INTEGER NOT NULL DEFAULT 0,
    "maxClientScore" INTEGER NOT NULL DEFAULT 0,
    "maxNqasScore" INTEGER NOT NULL DEFAULT 0,
    "compliancePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "strengths" TEXT,
    "recommendations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_responses" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "clientCheckpointId" TEXT NOT NULL,
    "clientScore" INTEGER NOT NULL DEFAULT 0,
    "nqasScore" INTEGER NOT NULL DEFAULT 0,
    "isNa" BOOLEAN NOT NULL DEFAULT false,
    "mappingSnapshotType" "ScoreMappingType",
    "mappingSnapshotFormula" JSONB,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remarks" TEXT,
    "sectionCode" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_reviews" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");

-- CreateIndex
CREATE INDEX "password_resets_token_idx" ON "password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "areas_of_concern_departmentId_idx" ON "areas_of_concern"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "areas_of_concern_code_departmentId_key" ON "areas_of_concern"("code", "departmentId");

-- CreateIndex
CREATE INDEX "standards_areaOfConcernId_idx" ON "standards"("areaOfConcernId");

-- CreateIndex
CREATE UNIQUE INDEX "standards_code_areaOfConcernId_key" ON "standards"("code", "areaOfConcernId");

-- CreateIndex
CREATE INDEX "measurable_elements_standardId_idx" ON "measurable_elements"("standardId");

-- CreateIndex
CREATE INDEX "measurable_elements_isScored_idx" ON "measurable_elements"("isScored");

-- CreateIndex
CREATE UNIQUE INDEX "measurable_elements_meRef_standardId_key" ON "measurable_elements"("meRef", "standardId");

-- CreateIndex
CREATE UNIQUE INDEX "client_departments_code_key" ON "client_departments"("code");

-- CreateIndex
CREATE INDEX "client_sections_clientDepartmentId_idx" ON "client_sections"("clientDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "client_sections_code_clientDepartmentId_key" ON "client_sections"("code", "clientDepartmentId");

-- CreateIndex
CREATE INDEX "client_checkpoints_clientSectionId_idx" ON "client_checkpoints"("clientSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "client_checkpoints_code_clientSectionId_key" ON "client_checkpoints"("code", "clientSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_mappings_clientCheckpointId_key" ON "checklist_mappings"("clientCheckpointId");

-- CreateIndex
CREATE INDEX "checklist_mappings_measurableElementId_idx" ON "checklist_mappings"("measurableElementId");

-- CreateIndex
CREATE INDEX "assessments_departmentId_idx" ON "assessments"("departmentId");

-- CreateIndex
CREATE INDEX "assessments_assessorId_idx" ON "assessments"("assessorId");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_quarter_year_idx" ON "assessments"("quarter", "year");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_departmentId_quarter_year_type_key" ON "assessments"("departmentId", "quarter", "year", "type");

-- CreateIndex
CREATE INDEX "assessment_responses_assessmentId_idx" ON "assessment_responses"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_responses_clientCheckpointId_idx" ON "assessment_responses"("clientCheckpointId");

-- CreateIndex
CREATE INDEX "assessment_responses_sectionCode_idx" ON "assessment_responses"("sectionCode");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_responses_assessmentId_clientCheckpointId_key" ON "assessment_responses"("assessmentId", "clientCheckpointId");

-- CreateIndex
CREATE INDEX "assessment_reviews_assessmentId_idx" ON "assessment_reviews"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_reviews_reviewerId_idx" ON "assessment_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas_of_concern" ADD CONSTRAINT "areas_of_concern_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards" ADD CONSTRAINT "standards_areaOfConcernId_fkey" FOREIGN KEY ("areaOfConcernId") REFERENCES "areas_of_concern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurable_elements" ADD CONSTRAINT "measurable_elements_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_sections" ADD CONSTRAINT "client_sections_clientDepartmentId_fkey" FOREIGN KEY ("clientDepartmentId") REFERENCES "client_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_checkpoints" ADD CONSTRAINT "client_checkpoints_clientSectionId_fkey" FOREIGN KEY ("clientSectionId") REFERENCES "client_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_mappings" ADD CONSTRAINT "checklist_mappings_clientCheckpointId_fkey" FOREIGN KEY ("clientCheckpointId") REFERENCES "client_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_mappings" ADD CONSTRAINT "checklist_mappings_measurableElementId_fkey" FOREIGN KEY ("measurableElementId") REFERENCES "measurable_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_clientCheckpointId_fkey" FOREIGN KEY ("clientCheckpointId") REFERENCES "client_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_reviews" ADD CONSTRAINT "assessment_reviews_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_reviews" ADD CONSTRAINT "assessment_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
