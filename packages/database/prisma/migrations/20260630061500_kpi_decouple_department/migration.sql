-- DropForeignKey
ALTER TABLE "indicator_entries" DROP CONSTRAINT "indicator_entries_departmentId_fkey";
-- DropForeignKey
ALTER TABLE "indicator_templates" DROP CONSTRAINT "indicator_templates_departmentId_fkey";
-- DropIndex
DROP INDEX "indicator_entries_departmentId_idx";
-- DropIndex
DROP INDEX "indicator_entries_templateId_departmentId_year_month_key";
-- DropIndex
DROP INDEX "indicator_templates_departmentId_idx";
-- AlterTable
ALTER TABLE "indicator_entries" DROP COLUMN "departmentId";
-- AlterTable
ALTER TABLE "indicator_templates" DROP COLUMN "departmentId",
ADD COLUMN     "departmentCode" TEXT,
ADD COLUMN     "departmentName" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "indicator_entries_templateId_year_month_key" ON "indicator_entries"("templateId", "year", "month");
-- CreateIndex
CREATE INDEX "indicator_templates_departmentCode_idx" ON "indicator_templates"("departmentCode");
