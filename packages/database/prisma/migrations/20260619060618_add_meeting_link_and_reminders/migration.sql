-- AlterTable
ALTER TABLE "committee_meetings" ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "reminderOffsets" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "sendEmail" BOOLEAN NOT NULL DEFAULT false;
