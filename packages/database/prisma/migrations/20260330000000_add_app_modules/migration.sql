-- CreateEnum
CREATE TYPE "AppModule" AS ENUM ('NQAS', 'NABH', 'KAYAKALPA');

-- AlterTable: Add moduleAccess to users (default all existing users to NQAS)
ALTER TABLE "users" ADD COLUMN "moduleAccess" "AppModule"[] NOT NULL DEFAULT ARRAY['NQAS']::"AppModule"[];

-- AlterTable: Add module to assessments (all existing assessments belong to NQAS)
ALTER TABLE "assessments" ADD COLUMN "module" "AppModule" NOT NULL DEFAULT 'NQAS';

-- DropIndex: Remove old unique constraint (no module column)
DROP INDEX IF EXISTS "assessments_departmentId_quarter_year_type_key";

-- CreateIndex: New unique constraint includes module
CREATE UNIQUE INDEX "assessments_departmentId_quarter_year_type_module_key" ON "assessments"("departmentId", "quarter", "year", "type", "module");
