-- CreateEnum
CREATE TYPE "IndicatorFramework" AS ENUM ('KPI', 'OUTCOME');

-- CreateEnum
CREATE TYPE "IndicatorFormula" AS ENUM ('RATIO', 'MEAN', 'MEDIAN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "IndicatorScope" AS ENUM ('HOSPITAL', 'DEPARTMENT');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "indicator_types" (
    "id" TEXT NOT NULL,
    "framework" "IndicatorFramework" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicator_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_templates" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numeratorLabel" TEXT,
    "denominatorLabel" TEXT,
    "formulaType" "IndicatorFormula" NOT NULL DEFAULT 'RATIO',
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "customExpression" TEXT,
    "unit" TEXT,
    "frequency" TEXT,
    "sourceOfData" TEXT,
    "significance" TEXT,
    "scope" "IndicatorScope" NOT NULL DEFAULT 'HOSPITAL',
    "departmentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicator_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_entries" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "departmentId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "numeratorValue" DOUBLE PRECISION,
    "denominatorValue" DOUBLE PRECISION,
    "sampleValues" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "computedResult" DOUBLE PRECISION,
    "note" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicator_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indicator_types_framework_idx" ON "indicator_types"("framework");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_types_framework_name_key" ON "indicator_types"("framework", "name");

-- CreateIndex
CREATE INDEX "indicator_templates_typeId_idx" ON "indicator_templates"("typeId");

-- CreateIndex
CREATE INDEX "indicator_templates_departmentId_idx" ON "indicator_templates"("departmentId");

-- CreateIndex
CREATE INDEX "indicator_entries_templateId_idx" ON "indicator_entries"("templateId");

-- CreateIndex
CREATE INDEX "indicator_entries_departmentId_idx" ON "indicator_entries"("departmentId");

-- CreateIndex
CREATE INDEX "indicator_entries_year_month_idx" ON "indicator_entries"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_entries_templateId_departmentId_year_month_key" ON "indicator_entries"("templateId", "departmentId", "year", "month");

-- AddForeignKey
ALTER TABLE "indicator_templates" ADD CONSTRAINT "indicator_templates_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "indicator_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_templates" ADD CONSTRAINT "indicator_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_templates" ADD CONSTRAINT "indicator_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_entries" ADD CONSTRAINT "indicator_entries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "indicator_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_entries" ADD CONSTRAINT "indicator_entries_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_entries" ADD CONSTRAINT "indicator_entries_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
