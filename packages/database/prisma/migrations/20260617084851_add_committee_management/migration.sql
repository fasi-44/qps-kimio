-- CreateEnum
CREATE TYPE "CommitteeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MeetingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MeetingMode" AS ENUM ('PHYSICAL', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('DESIGNATION', 'NOMINATION');

-- CreateEnum
CREATE TYPE "MembershipChangeType" AS ENUM ('ADDED', 'REMOVED', 'REPLACED', 'ROLE_CHANGED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE_OF_ABSENCE', 'INVITED_GUEST');

-- CreateEnum
CREATE TYPE "AgendaStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUESTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "MinutesMethod" AS ENUM ('DIRECT', 'UPLOAD');

-- CreateEnum
CREATE TYPE "MinutesStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CLOSED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActionSource" AS ENUM ('AGENDA', 'AUDIT_FINDING', 'INCIDENT', 'ASSESSMENT', 'COMMITTEE_DECISION');

-- CreateEnum
CREATE TYPE "CarryForwardDecision" AS ENUM ('CONTINUE', 'MODIFY_DUE_DATE', 'ESCALATE', 'CLOSE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'COMMITTEE_MEETING_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'AGENDA_DEADLINE';
ALTER TYPE "NotificationType" ADD VALUE 'MINUTES_PENDING_APPROVAL';
ALTER TYPE "NotificationType" ADD VALUE 'ACTION_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'COMMITTEE_TENURE_EXPIRY';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "designationId" TEXT;

-- CreateTable
CREATE TABLE "designations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_position_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isLeadership" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committee_position_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "type" TEXT,
    "purpose" TEXT,
    "frequency" "MeetingFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "effectiveDate" DATE,
    "expiryDate" DATE,
    "status" "CommitteeStatus" NOT NULL DEFAULT 'ACTIVE',
    "module" "AppModule" NOT NULL DEFAULT 'NQAS',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_members" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "positionTypeId" TEXT NOT NULL,
    "membershipType" "MembershipType" NOT NULL DEFAULT 'NOMINATION',
    "userId" TEXT,
    "designationId" TEXT,
    "departmentId" TEXT,
    "nomineeName" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_membership_history" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "memberId" TEXT,
    "changeType" "MembershipChangeType" NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "changedById" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_membership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_meetings" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "venue" TEXT,
    "mode" "MeetingMode" NOT NULL DEFAULT 'PHYSICAL',
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "parentMeetingId" TEXT,
    "agendaDeadline" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committee_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_items" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "submittedById" TEXT NOT NULL,
    "status" "AgendaStatus" NOT NULL DEFAULT 'SUBMITTED',
    "supportingDocs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewComment" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_minutes" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "method" "MinutesMethod" NOT NULL DEFAULT 'DIRECT',
    "status" "MinutesStatus" NOT NULL DEFAULT 'DRAFT',
    "fileUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minute_entries" (
    "id" TEXT NOT NULL,
    "minutesId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "discussionSummary" TEXT,
    "decisions" TEXT,
    "recommendations" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "minute_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "meetingId" TEXT,
    "agendaItemId" TEXT,
    "source" "ActionSource" NOT NULL DEFAULT 'COMMITTEE_DECISION',
    "responsibleUserId" TEXT,
    "department" TEXT,
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" DATE,
    "targetCompletionDate" DATE,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "remarks" TEXT,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "closedById" TEXT,
    "reopenedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_carry_forwards" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "fromMeetingId" TEXT,
    "toMeetingId" TEXT,
    "decision" "CarryForwardDecision" NOT NULL DEFAULT 'CONTINUE',
    "newDueDate" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_carry_forwards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "designations_code_key" ON "designations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "committee_position_types_name_key" ON "committee_position_types"("name");

-- CreateIndex
CREATE INDEX "committees_status_idx" ON "committees"("status");

-- CreateIndex
CREATE INDEX "committees_module_idx" ON "committees"("module");

-- CreateIndex
CREATE INDEX "committees_createdById_idx" ON "committees"("createdById");

-- CreateIndex
CREATE INDEX "committee_members_committeeId_idx" ON "committee_members"("committeeId");

-- CreateIndex
CREATE INDEX "committee_members_userId_idx" ON "committee_members"("userId");

-- CreateIndex
CREATE INDEX "committee_members_designationId_idx" ON "committee_members"("designationId");

-- CreateIndex
CREATE INDEX "committee_members_positionTypeId_idx" ON "committee_members"("positionTypeId");

-- CreateIndex
CREATE INDEX "committee_membership_history_committeeId_idx" ON "committee_membership_history"("committeeId");

-- CreateIndex
CREATE INDEX "committee_membership_history_memberId_idx" ON "committee_membership_history"("memberId");

-- CreateIndex
CREATE INDEX "committee_meetings_committeeId_idx" ON "committee_meetings"("committeeId");

-- CreateIndex
CREATE INDEX "committee_meetings_status_idx" ON "committee_meetings"("status");

-- CreateIndex
CREATE INDEX "committee_meetings_scheduledDate_idx" ON "committee_meetings"("scheduledDate");

-- CreateIndex
CREATE INDEX "committee_meetings_parentMeetingId_idx" ON "committee_meetings"("parentMeetingId");

-- CreateIndex
CREATE INDEX "meeting_attendance_meetingId_idx" ON "meeting_attendance"("meetingId");

-- CreateIndex
CREATE INDEX "meeting_attendance_memberId_idx" ON "meeting_attendance"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendance_meetingId_memberId_key" ON "meeting_attendance"("meetingId", "memberId");

-- CreateIndex
CREATE INDEX "agenda_items_meetingId_idx" ON "agenda_items"("meetingId");

-- CreateIndex
CREATE INDEX "agenda_items_submittedById_idx" ON "agenda_items"("submittedById");

-- CreateIndex
CREATE INDEX "agenda_items_status_idx" ON "agenda_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_meetingId_key" ON "meeting_minutes"("meetingId");

-- CreateIndex
CREATE INDEX "meeting_minutes_status_idx" ON "meeting_minutes"("status");

-- CreateIndex
CREATE INDEX "minute_entries_minutesId_idx" ON "minute_entries"("minutesId");

-- CreateIndex
CREATE INDEX "minute_entries_agendaItemId_idx" ON "minute_entries"("agendaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "action_items_actionCode_key" ON "action_items"("actionCode");

-- CreateIndex
CREATE INDEX "action_items_committeeId_idx" ON "action_items"("committeeId");

-- CreateIndex
CREATE INDEX "action_items_meetingId_idx" ON "action_items"("meetingId");

-- CreateIndex
CREATE INDEX "action_items_status_idx" ON "action_items"("status");

-- CreateIndex
CREATE INDEX "action_items_responsibleUserId_idx" ON "action_items"("responsibleUserId");

-- CreateIndex
CREATE INDEX "action_carry_forwards_actionId_idx" ON "action_carry_forwards"("actionId");

-- CreateIndex
CREATE INDEX "action_carry_forwards_fromMeetingId_idx" ON "action_carry_forwards"("fromMeetingId");

-- CreateIndex
CREATE INDEX "action_carry_forwards_toMeetingId_idx" ON "action_carry_forwards"("toMeetingId");

-- CreateIndex
CREATE INDEX "users_designationId_idx" ON "users"("designationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committees" ADD CONSTRAINT "committees_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_positionTypeId_fkey" FOREIGN KEY ("positionTypeId") REFERENCES "committee_position_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_membership_history" ADD CONSTRAINT "committee_membership_history_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_membership_history" ADD CONSTRAINT "committee_membership_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_parentMeetingId_fkey" FOREIGN KEY ("parentMeetingId") REFERENCES "committee_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "committee_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "committee_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "committee_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "committee_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minute_entries" ADD CONSTRAINT "minute_entries_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "meeting_minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minute_entries" ADD CONSTRAINT "minute_entries_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "agenda_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "committee_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "agenda_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_carry_forwards" ADD CONSTRAINT "action_carry_forwards_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "action_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_carry_forwards" ADD CONSTRAINT "action_carry_forwards_fromMeetingId_fkey" FOREIGN KEY ("fromMeetingId") REFERENCES "committee_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_carry_forwards" ADD CONSTRAINT "action_carry_forwards_toMeetingId_fkey" FOREIGN KEY ("toMeetingId") REFERENCES "committee_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_carry_forwards" ADD CONSTRAINT "action_carry_forwards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
