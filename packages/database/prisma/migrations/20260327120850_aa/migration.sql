/*
  Warnings:

  - You are about to drop the column `code` on the `client_checkpoints` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `client_checkpoints` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `client_sections` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `client_sections` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `client_sections` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[checkpointCode,clientSectionId]` on the table `client_checkpoints` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nqasDepartmentId]` on the table `client_departments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sectionCode,clientDepartmentId]` on the table `client_sections` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `checkpointCode` to the `client_checkpoints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `checkpointOrder` to the `client_checkpoints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionCode` to the `client_sections` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionName` to the `client_sections` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionOrder` to the `client_sections` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "client_checkpoints_code_clientSectionId_key";

-- DropIndex
DROP INDEX "client_sections_code_clientDepartmentId_key";

-- AlterTable
ALTER TABLE "client_checkpoints" DROP COLUMN "code",
DROP COLUMN "order",
ADD COLUMN     "checkpointCode" TEXT NOT NULL,
ADD COLUMN     "checkpointOrder" INTEGER NOT NULL,
ADD COLUMN     "evidenceRequired" TEXT;

-- AlterTable
ALTER TABLE "client_departments" ADD COLUMN     "nqasDepartmentId" TEXT;

-- AlterTable
ALTER TABLE "client_sections" DROP COLUMN "code",
DROP COLUMN "name",
DROP COLUMN "order",
ADD COLUMN     "sectionCode" TEXT NOT NULL,
ADD COLUMN     "sectionName" TEXT NOT NULL,
ADD COLUMN     "sectionOrder" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "client_checkpoints_checkpointCode_clientSectionId_key" ON "client_checkpoints"("checkpointCode", "clientSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "client_departments_nqasDepartmentId_key" ON "client_departments"("nqasDepartmentId");

-- CreateIndex
CREATE INDEX "client_departments_nqasDepartmentId_idx" ON "client_departments"("nqasDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "client_sections_sectionCode_clientDepartmentId_key" ON "client_sections"("sectionCode", "clientDepartmentId");

-- AddForeignKey
ALTER TABLE "client_departments" ADD CONSTRAINT "client_departments_nqasDepartmentId_fkey" FOREIGN KEY ("nqasDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
