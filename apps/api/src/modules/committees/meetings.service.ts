import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../notifications/mail.service';
import { renderTemplate } from '../email-templates/email-templates.service';
import {
  CreateMeetingDto, UpdateMeetingDto, RescheduleMeetingDto, CancelMeetingDto, SaveAttendanceDto,
  MeetingAgendaItemDto,
} from './dto/meeting.dto';
import {
  MeetingStatus, MeetingFrequency, NotificationType, AppModule, AgendaStatus,
  generateOccurrences, RecurrenceRule,
} from '@nabh/shared';
import { assertCommitteeActive } from './committee-active.util';

const DEFAULT_OCCURRENCES = 12;
// meetingLink / sendEmail / reminderOffsets supported (migration 20260619060618)

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private mail: MailService,
  ) {}

  async list(committeeId: string, filters: { status?: string; upcoming?: boolean } = {}) {
    await this.ensureCommittee(committeeId);
    const where: any = { committeeId };
    if (filters.status) where.status = filters.status;
    if (filters.upcoming) where.scheduledDate = { gte: new Date() };
    return this.prisma.committeeMeeting.findMany({
      where,
      orderBy: { scheduledDate: 'asc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { agendaItems: true, attendance: true, actions: true } },
      },
    });
  }

  async create(committeeId: string, dto: CreateMeetingDto, userId: string) {
    const committee = await this.prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) throw new NotFoundException('Committee not found');
    assertCommitteeActive(committee.status);

    const baseDate = new Date(dto.scheduledDate);
    const deadline = dto.agendaDeadline ? new Date(dto.agendaDeadline) : null;

    // Mode/notification fields shared across one-time and every occurrence in a series
    const common = {
      time: dto.time ?? null,
      venue: dto.venue ?? null,
      meetingLink: dto.meetingLink ?? null,
      mode: dto.mode ?? undefined,
      sendEmail: dto.sendEmail ?? false,
      reminderOffsets: dto.sendEmail ? (dto.reminderOffsets ?? []) : [],
      reminderTemplateId: dto.sendEmail ? (dto.reminderTemplateId ?? null) : null,
    };

    // One-time meeting
    if (!dto.isRecurring) {
      const meeting = await this.prisma.committeeMeeting.create({
        data: {
          committeeId,
          title: dto.title,
          scheduledDate: baseDate,
          ...common,
          agendaDeadline: deadline,
          createdById: userId,
        },
      });
      await this.createPublishedAgenda(meeting.id, dto.agendaItems ?? [], userId);
      await this.afterCreate([meeting], committee.name, userId);
      return meeting;
    }

    // Recurring series — resolve the concrete occurrence dates and the rule string.
    let dates: Date[];
    let recurrenceRule: string;
    if (dto.recurrence) {
      // Outlook-style pattern (preferred path).
      dates = generateOccurrences(baseDate, dto.recurrence as RecurrenceRule);
      if (dates.length === 0) {
        throw new BadRequestException('This recurrence pattern produces no occurrences — check the start and end dates.');
      }
      recurrenceRule = JSON.stringify(dto.recurrence);
    } else {
      // Legacy simple frequency × occurrences.
      const frequency = dto.frequency ?? committee.frequency;
      if (frequency === MeetingFrequency.CUSTOM) {
        throw new BadRequestException('Recurring meetings require a non-custom frequency (MONTHLY, QUARTERLY, HALF_YEARLY or YEARLY)');
      }
      const count = Math.min(dto.occurrences ?? DEFAULT_OCCURRENCES, 24);
      dates = Array.from({ length: count }, (_, i) => (i === 0 ? baseDate : addInterval(baseDate, frequency, i)));
      recurrenceRule = `${frequency}:${count}`;
    }

    // The series anchors on the first generated date (Outlook shifts the start to the first match).
    const deadlineOffsetMs = deadline ? baseDate.getTime() - deadline.getTime() : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const make = (date: Date, parentId?: string) =>
        tx.committeeMeeting.create({
          data: {
            committeeId,
            title: dto.title,
            scheduledDate: date,
            ...common,
            agendaDeadline: deadlineOffsetMs !== null ? new Date(date.getTime() - deadlineOffsetMs) : null,
            isRecurring: true,
            recurrenceRule,
            ...(parentId ? { parentMeetingId: parentId } : {}),
            createdById: userId,
          },
        });
      const parent = await make(dates[0]);
      const series = [parent];
      for (let i = 1; i < dates.length; i++) series.push(await make(dates[i], parent.id));
      return series;
    });

    // Agenda items entered at creation attach to the first meeting of the series
    await this.createPublishedAgenda(created[0].id, dto.agendaItems ?? [], userId);
    await this.afterCreate(created, committee.name, userId);
    return { count: created.length, meetings: created };
  }

  // Agenda items captured during meeting creation are approved & published immediately.
  private async createPublishedAgenda(meetingId: string, items: MeetingAgendaItemDto[], userId: string) {
    if (!items.length) return;
    await this.prisma.$transaction(
      items.map((it, i) =>
        this.prisma.agendaItem.create({
          data: {
            meetingId,
            title: it.title,
            description: it.description ?? null,
            supportingDocs: it.supportingDocs ?? [],
            submittedById: userId,
            order: i + 1,
            status: AgendaStatus.PUBLISHED,
            reviewComment: 'Added at meeting creation (auto-approved & published)',
          },
        }),
      ),
    );
    await this.audit.log({
      userId, action: 'PUBLISH_AGENDA', resource: 'CommitteeMeeting', resourceId: meetingId,
      newValue: { publishedAtCreation: items.length },
    });
  }

  async findOne(meetingId: string) {
    const meeting = await this.prisma.committeeMeeting.findUnique({
      where: { id: meetingId },
      include: {
        committee: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        attendance: { include: { member: { include: { positionType: true, user: { select: { id: true, name: true } } } } } },
        _count: { select: { agendaItems: true, actions: true } },
      },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async update(meetingId: string, dto: UpdateMeetingDto, userId: string) {
    const existing = await this.prisma.committeeMeeting.findUnique({
      where: { id: meetingId }, include: { committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Meeting not found');
    assertCommitteeActive(existing.committee.status);

    const meeting = await this.prisma.committeeMeeting.update({
      where: { id: meetingId },
      data: {
        title: dto.title ?? undefined,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        time: dto.time !== undefined ? dto.time : undefined,
        venue: dto.venue !== undefined ? dto.venue : undefined,
        meetingLink: dto.meetingLink !== undefined ? dto.meetingLink : undefined,
        mode: dto.mode ?? undefined,
        agendaDeadline: dto.agendaDeadline ? new Date(dto.agendaDeadline) : undefined,
        status: dto.status ?? undefined,
        sendEmail: dto.sendEmail !== undefined ? dto.sendEmail : undefined,
        reminderOffsets: dto.reminderOffsets !== undefined ? dto.reminderOffsets : undefined,
        reminderTemplateId: dto.reminderTemplateId !== undefined ? dto.reminderTemplateId : undefined,
      },
    });

    await this.audit.log({
      userId, action: 'UPDATE_MEETING', resource: 'CommitteeMeeting', resourceId: meetingId,
      oldValue: { title: existing.title, scheduledDate: existing.scheduledDate, status: existing.status },
      newValue: { title: meeting.title, scheduledDate: meeting.scheduledDate, status: meeting.status },
    });
    return meeting;
  }

  async reschedule(meetingId: string, dto: RescheduleMeetingDto, userId: string) {
    const existing = await this.prisma.committeeMeeting.findUnique({
      where: { id: meetingId }, include: { committee: { select: { name: true, status: true } } },
    });
    if (!existing) throw new NotFoundException('Meeting not found');
    assertCommitteeActive(existing.committee.status);
    if (existing.status === MeetingStatus.CANCELLED) throw new BadRequestException('Cannot reschedule a cancelled meeting');

    const meeting = await this.prisma.committeeMeeting.update({
      where: { id: meetingId },
      data: {
        scheduledDate: new Date(dto.scheduledDate),
        time: dto.time !== undefined ? dto.time : undefined,
        venue: dto.venue !== undefined ? dto.venue : undefined,
        status: MeetingStatus.RESCHEDULED,
      },
    });

    await this.audit.log({
      userId, action: 'RESCHEDULE_MEETING', resource: 'CommitteeMeeting', resourceId: meetingId,
      oldValue: { scheduledDate: existing.scheduledDate }, newValue: { scheduledDate: meeting.scheduledDate, reason: dto.reason },
    });
    await this.notifyMembers(existing.committeeId, NotificationType.COMMITTEE_MEETING_SCHEDULED,
      'Meeting rescheduled', `"${meeting.title}" for ${existing.committee.name} was rescheduled to ${formatDate(meeting.scheduledDate)}`,
      { committeeId: existing.committeeId, meetingId });
    return meeting;
  }

  async cancel(meetingId: string, dto: CancelMeetingDto, userId: string) {
    const existing = await this.prisma.committeeMeeting.findUnique({
      where: { id: meetingId }, include: { committee: { select: { name: true, status: true } } },
    });
    if (!existing) throw new NotFoundException('Meeting not found');
    assertCommitteeActive(existing.committee.status);

    const meeting = await this.prisma.committeeMeeting.update({
      where: { id: meetingId }, data: { status: MeetingStatus.CANCELLED },
    });

    await this.audit.log({
      userId, action: 'CANCEL_MEETING', resource: 'CommitteeMeeting', resourceId: meetingId,
      oldValue: { status: existing.status }, newValue: { status: meeting.status, reason: dto.reason },
    });
    await this.notifyMembers(existing.committeeId, NotificationType.COMMITTEE_MEETING_SCHEDULED,
      'Meeting cancelled', `"${meeting.title}" for ${existing.committee.name} on ${formatDate(existing.scheduledDate)} was cancelled`,
      { committeeId: existing.committeeId, meetingId });
    return meeting;
  }

  // ─── Attendance ─────────────────────────────────────────────────────────────

  async getAttendance(meetingId: string) {
    await this.ensureMeeting(meetingId);
    return this.prisma.meetingAttendance.findMany({
      where: { meetingId },
      include: { member: { include: { positionType: true, user: { select: { id: true, name: true, email: true } }, designation: true } } },
    });
  }

  async saveAttendance(meetingId: string, dto: SaveAttendanceDto, userId: string) {
    const meeting = await this.ensureMeeting(meetingId);
    assertCommitteeActive(meeting.committee.status);

    // Guard: every memberId must belong to this committee
    const memberIds = dto.entries.map((e) => e.memberId);
    const members = await this.prisma.committeeMember.findMany({
      where: { id: { in: memberIds }, committeeId: meeting.committeeId }, select: { id: true },
    });
    const valid = new Set(members.map((m) => m.id));
    const invalid = memberIds.filter((id) => !valid.has(id));
    if (invalid.length) throw new BadRequestException(`Member(s) not in this committee: ${invalid.join(', ')}`);

    await this.prisma.$transaction(
      dto.entries.map((e) =>
        this.prisma.meetingAttendance.upsert({
          where: { meetingId_memberId: { meetingId, memberId: e.memberId } },
          update: { status: e.status, remarks: e.remarks ?? null },
          create: { meetingId, memberId: e.memberId, status: e.status, remarks: e.remarks ?? null },
        }),
      ),
    );

    // Signed attendance sheet(s) live on the meeting itself
    if (dto.attendanceDocs !== undefined) {
      await this.prisma.committeeMeeting.update({
        where: { id: meetingId }, data: { attendanceDocs: { set: dto.attendanceDocs } },
      });
    }

    await this.audit.log({
      userId, action: 'SAVE_ATTENDANCE', resource: 'CommitteeMeeting', resourceId: meetingId,
      newValue: { count: dto.entries.length, docs: dto.attendanceDocs?.length ?? undefined },
    });
    return this.getAttendance(meetingId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────--

  private async ensureCommittee(id: string) {
    const c = await this.prisma.committee.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException('Committee not found');
    return c;
  }

  private async ensureMeeting(id: string) {
    const m = await this.prisma.committeeMeeting.findUnique({
      where: { id }, select: { id: true, committeeId: true, committee: { select: { status: true } } },
    });
    if (!m) throw new NotFoundException('Meeting not found');
    return m;
  }

  private async afterCreate(meetings: { id: string; title: string; scheduledDate: Date }[], committeeName: string, userId: string) {
    const first = meetings[0];
    await this.audit.log({
      userId, action: 'CREATE_MEETING', resource: 'CommitteeMeeting', resourceId: first.id,
      newValue: { title: first.title, scheduledDate: first.scheduledDate, generated: meetings.length },
    });
    await this.notifyMembers(
      (await this.prisma.committeeMeeting.findUnique({ where: { id: first.id }, select: { committeeId: true } }))!.committeeId,
      NotificationType.COMMITTEE_MEETING_SCHEDULED,
      'Meeting scheduled',
      `"${first.title}" for ${committeeName} is scheduled on ${formatDate(first.scheduledDate)}`,
      { meetingId: first.id },
    );
    await this.sendReminderEmails(first.id, committeeName);
  }

  /**
   * When a meeting has email reminders enabled and a template selected, render
   * the template per-member and email it. Best-effort: missing template, no
   * recipients, or SMTP failures never block meeting creation.
   */
  private async sendReminderEmails(meetingId: string, committeeName: string) {
    const meeting = await this.prisma.committeeMeeting.findUnique({
      where: { id: meetingId },
      select: {
        committeeId: true, title: true, scheduledDate: true, time: true, venue: true,
        meetingLink: true, mode: true, sendEmail: true, reminderTemplateId: true,
      },
    });
    if (!meeting?.sendEmail || !meeting.reminderTemplateId) return;

    const template = await this.prisma.emailTemplate.findUnique({ where: { id: meeting.reminderTemplateId } });
    if (!template || !template.isActive) return;

    const members = await this.prisma.committeeMember.findMany({
      where: { committeeId: meeting.committeeId, isActive: true, userId: { not: null } },
      select: { user: { select: { name: true, email: true } } },
    });
    const recipients = members
      .map((m) => m.user)
      .filter((u): u is { name: string; email: string } => !!u?.email);
    if (recipients.length === 0) return;

    const baseVars: Record<string, string> = {
      committeeName,
      meetingTitle: meeting.title,
      meetingDate: formatDate(meeting.scheduledDate),
      meetingTime: meeting.time ?? '',
      venue: meeting.venue ?? '',
      meetingLink: meeting.meetingLink ?? '',
      mode: meeting.mode,
    };

    await Promise.all(
      recipients.map((r) => {
        const vars = { ...baseVars, memberName: r.name };
        return this.mail.sendRendered(
          r.email,
          renderTemplate(template.subject, vars),
          renderTemplate(template.body, vars),
        );
      }),
    );
  }

  // Notify all active committee members who are linked to a user account.
  private async notifyMembers(committeeId: string, type: NotificationType, title: string, message: string, meta: Record<string, any>) {
    const members = await this.prisma.committeeMember.findMany({
      where: { committeeId, isActive: true, userId: { not: null } },
      select: { userId: true },
    });
    const userIds = [...new Set(members.map((m) => m.userId).filter((id): id is string => !!id))];
    await Promise.all(
      userIds.map((uid) =>
        this.notifications.create({ userId: uid, type, module: AppModule.NQAS, title, message, meta: { ...meta, committeeId } }),
      ),
    );
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addInterval(base: Date, frequency: string, steps: number): Date {
  const monthsPerStep: Record<string, number> = {
    [MeetingFrequency.MONTHLY]: 1,
    [MeetingFrequency.QUARTERLY]: 3,
    [MeetingFrequency.HALF_YEARLY]: 6,
    [MeetingFrequency.YEARLY]: 12,
  };
  const months = (monthsPerStep[frequency] ?? 1) * steps;
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}
