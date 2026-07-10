-- AlterTable
ALTER TABLE "committee_meetings" ADD COLUMN     "attendanceDocs" TEXT[] DEFAULT ARRAY[]::TEXT[];
