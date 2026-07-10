-- DropIndex
DROP INDEX "indicator_types_framework_name_key";
-- AlterTable
ALTER TABLE "indicator_types" ADD COLUMN     "departmentCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "departmentName" TEXT;
-- CreateIndex
CREATE INDEX "indicator_types_departmentCode_idx" ON "indicator_types"("departmentCode");
-- CreateIndex
CREATE UNIQUE INDEX "indicator_types_framework_departmentCode_name_key" ON "indicator_types"("framework", "departmentCode", "name");
