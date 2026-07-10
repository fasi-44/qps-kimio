-- AlterTable
ALTER TABLE "indicator_templates" ADD COLUMN     "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "target" DOUBLE PRECISION;
