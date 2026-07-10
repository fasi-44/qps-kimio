import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SaveMinutesDto, TransitionMinutesDto } from './dto/minutes.dto';
import {
  MinutesStatus, MinutesMethod, NotificationType, AppModule, UserRole, JwtPayload,
} from '@nabh/shared';
import { assertCommitteeActive } from './committee-active.util';

// Allowed status transitions. 'gate' = who may perform it:
//   'edit'    → editor (ADMIN/HOD — Member Secretary mapping)
//   'approve' → position-gated (Chairperson / canApprove member) or ADMIN
const TRANSITIONS: Record<string, { from: MinutesStatus; to: MinutesStatus; gate: 'edit' | 'approve' }> = {
  SUBMIT:    { from: MinutesStatus.DRAFT,        to: MinutesStatus.UNDER_REVIEW, gate: 'edit' },
  APPROVE:   { from: MinutesStatus.UNDER_REVIEW, to: MinutesStatus.APPROVED,     gate: 'approve' },
  PUBLISH:   { from: MinutesStatus.APPROVED,     to: MinutesStatus.PUBLISHED,    gate: 'approve' },
  SEND_BACK: { from: MinutesStatus.UNDER_REVIEW, to: MinutesStatus.DRAFT,        gate: 'approve' },
};

@Injectable()
export class MinutesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async get(meetingId: string) {
    await this.ensureMeeting(meetingId);
    return this.prisma.meetingMinutes.findUnique({
      where: { meetingId },
      include: {
        approvedBy: { select: { id: true, name: true } },
        entries: {
          orderBy: { order: 'asc' },
          include: { agendaItem: { select: { id: true, title: true } } },
        },
      },
    });
  }

  async save(meetingId: string, dto: SaveMinutesDto, user: JwtPayload) {
    const meeting = await this.ensureMeeting(meetingId);
    assertCommitteeActive(meeting.committee.status);
    if (dto.method === MinutesMethod.UPLOAD && !dto.fileUrl) {
      throw new BadRequestException('Upload method requires a fileUrl');
    }

    const existing = await this.prisma.meetingMinutes.findUnique({ where: { meetingId } });
    if (existing && existing.status !== MinutesStatus.DRAFT) {
      throw new BadRequestException(`Minutes are ${existing.status} and can no longer be edited. Send back to draft first.`);
    }

    const minutes = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.meetingMinutes.upsert({
        where: { meetingId },
        update: { method: dto.method, fileUrl: dto.fileUrl ?? null, version: { increment: 1 } },
        create: { meetingId, method: dto.method, fileUrl: dto.fileUrl ?? null, status: MinutesStatus.DRAFT },
      });

      if (dto.method === MinutesMethod.DIRECT) {
        await tx.minuteEntry.deleteMany({ where: { minutesId: rec.id } });
        const entries = dto.entries ?? [];
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          await tx.minuteEntry.create({
            data: {
              minutesId: rec.id,
              agendaItemId: e.agendaItemId ?? null,
              discussionSummary: e.discussionSummary ?? null,
              decisions: e.decisions ?? null,
              recommendations: e.recommendations ?? null,
              order: i + 1,
            },
          });
        }
      }
      return rec;
    });

    await this.audit.log({
      userId: user.sub, action: 'SAVE_MINUTES', resource: 'MeetingMinutes', resourceId: minutes.id,
      newValue: { meetingId, method: dto.method, entries: dto.entries?.length ?? 0 },
    });
    return this.get(meetingId);
  }

  async transition(meetingId: string, dto: TransitionMinutesDto, user: JwtPayload) {
    const meeting = await this.ensureMeeting(meetingId);
    assertCommitteeActive(meeting.committee.status);
    const minutes = await this.prisma.meetingMinutes.findUnique({ where: { meetingId } });
    if (!minutes) throw new NotFoundException('No minutes recorded for this meeting yet');

    const t = TRANSITIONS[dto.action];
    if (!t) throw new BadRequestException('Invalid action');
    if (minutes.status !== t.from) {
      throw new BadRequestException(`Cannot ${dto.action.toLowerCase()} minutes in status ${minutes.status}`);
    }
    if (t.gate === 'approve') await this.assertCanApprove(meeting.committeeId, user);

    const updated = await this.prisma.meetingMinutes.update({
      where: { meetingId },
      data: {
        status: t.to,
        ...(dto.action === 'APPROVE' ? { approvedById: user.sub } : {}),
        ...(dto.action === 'PUBLISH' ? { publishedAt: new Date() } : {}),
        ...(dto.action === 'SEND_BACK' ? { approvedById: null } : {}),
      },
    });

    await this.audit.log({
      userId: user.sub, action: `MINUTES_${dto.action}`, resource: 'MeetingMinutes', resourceId: minutes.id,
      oldValue: { status: minutes.status }, newValue: { status: updated.status, comment: dto.comment },
    });

    if (dto.action === 'SUBMIT') {
      await this.notifyApprovers(meeting.committeeId, 'Minutes pending approval',
        'Draft minutes have been submitted for review', { committeeId: meeting.committeeId, meetingId });
    } else if (dto.action === 'PUBLISH') {
      await this.notifyMembers(meeting.committeeId, 'Minutes published',
        'The minutes of meeting have been published', { committeeId: meeting.committeeId, meetingId });
    }
    return updated;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────--

  private async ensureMeeting(id: string) {
    const m = await this.prisma.committeeMeeting.findUnique({
      where: { id }, select: { id: true, committeeId: true, committee: { select: { status: true } } },
    });
    if (!m) throw new NotFoundException('Meeting not found');
    return m;
  }

  private async assertCanApprove(committeeId: string, user: JwtPayload) {
    if (user.role === UserRole.ADMIN) return;
    const member = await this.prisma.committeeMember.findFirst({
      where: { committeeId, isActive: true, userId: user.sub, positionType: { canApprove: true } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Only the Chairperson / Member Secretary (or an admin) may approve or publish minutes');
  }

  private async notifyMembers(committeeId: string, title: string, message: string, meta: Record<string, any>) {
    await this.fanOut({ committeeId, isActive: true, userId: { not: null } }, title, message, meta);
  }

  private async notifyApprovers(committeeId: string, title: string, message: string, meta: Record<string, any>) {
    await this.fanOut({ committeeId, isActive: true, userId: { not: null }, positionType: { canApprove: true } }, title, message, meta);
  }

  private async fanOut(where: any, title: string, message: string, meta: Record<string, any>) {
    const members = await this.prisma.committeeMember.findMany({ where, select: { userId: true } });
    const ids = [...new Set(members.map((m) => m.userId).filter((id): id is string => !!id))];
    await Promise.all(ids.map((uid) =>
      this.notifications.create({ userId: uid, type: NotificationType.SYSTEM, module: AppModule.NQAS, title, message, meta }),
    ));
  }
}
