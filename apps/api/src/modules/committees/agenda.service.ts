import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitAgendaDto, UpdateAgendaDto, ReviewAgendaDto } from './dto/agenda.dto';
import {
  AgendaStatus, NotificationType, AppModule, UserRole, JwtPayload,
} from '@nabh/shared';
import { assertCommitteeActive } from './committee-active.util';

const SUBMITTER_INCLUDE = { submittedBy: { select: { id: true, name: true, email: true } } } as const;

@Injectable()
export class AgendaService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async list(meetingId: string) {
    await this.ensureMeeting(meetingId);
    return this.prisma.agendaItem.findMany({
      where: { meetingId },
      orderBy: { order: 'asc' },
      include: SUBMITTER_INCLUDE,
    });
  }

  async submit(meetingId: string, dto: SubmitAgendaDto, user: JwtPayload) {
    const meeting = await this.ensureMeeting(meetingId);
    assertCommitteeActive(meeting.committee.status);
    const last = await this.prisma.agendaItem.findFirst({
      where: { meetingId }, orderBy: { order: 'desc' }, select: { order: true },
    });

    // Approvers (Chair / Vice-Chair / Member Secretary / Admin) bypass review — auto-approved.
    const autoApprove = await this.isApprover(meeting.committeeId, user);

    const item = await this.prisma.agendaItem.create({
      data: {
        meetingId,
        title: dto.title,
        description: dto.description ?? null,
        supportingDocs: dto.supportingDocs ?? [],
        submittedById: user.sub,
        order: (last?.order ?? 0) + 1,
        ...(autoApprove
          ? { status: AgendaStatus.ACCEPTED, reviewComment: 'Auto-approved (added by an approver)' }
          : {}),
      },
      include: SUBMITTER_INCLUDE,
    });

    await this.audit.log({
      userId: user.sub, action: autoApprove ? 'SUBMIT_AGENDA_AUTO_APPROVED' : 'SUBMIT_AGENDA',
      resource: 'AgendaItem', resourceId: item.id,
      newValue: { meetingId, title: item.title, status: item.status },
    });
    if (!autoApprove) {
      await this.notifyApprovers(meeting.committeeId, 'Agenda item submitted', `"${item.title}" was submitted for review`, { committeeId: meeting.committeeId, meetingId });
    }
    return item;
  }

  async update(agendaId: string, dto: UpdateAgendaDto, user: JwtPayload) {
    const existing = await this.prisma.agendaItem.findUnique({
      where: { id: agendaId }, include: { meeting: { select: { committeeId: true, committee: { select: { status: true } } } }, ...SUBMITTER_INCLUDE },
    });
    if (!existing) throw new NotFoundException('Agenda item not found');
    assertCommitteeActive(existing.meeting.committee.status);
    if (existing.status === AgendaStatus.PUBLISHED) throw new BadRequestException('Published agenda items cannot be edited');
    if (user.role !== UserRole.ADMIN && existing.submittedById !== user.sub) {
      throw new ForbiddenException('Only the submitter (or an admin) can edit this agenda item');
    }

    // Editing after a clarification request re-opens the item for review (new version)
    const reopen = existing.status === AgendaStatus.CLARIFICATION_REQUESTED;
    const item = await this.prisma.agendaItem.update({
      where: { id: agendaId },
      data: {
        title: dto.title ?? undefined,
        description: dto.description !== undefined ? dto.description : undefined,
        supportingDocs: dto.supportingDocs ?? undefined,
        ...(reopen ? { status: AgendaStatus.SUBMITTED, version: { increment: 1 }, reviewComment: null } : {}),
      },
      include: SUBMITTER_INCLUDE,
    });

    await this.audit.log({
      userId: user.sub, action: 'UPDATE_AGENDA', resource: 'AgendaItem', resourceId: agendaId,
      oldValue: { title: existing.title, status: existing.status },
      newValue: { title: item.title, status: item.status },
    });
    return item;
  }

  async review(agendaId: string, dto: ReviewAgendaDto, user: JwtPayload) {
    const existing = await this.prisma.agendaItem.findUnique({
      where: { id: agendaId },
      include: { meeting: { select: { committeeId: true, committee: { select: { status: true } } } }, ...SUBMITTER_INCLUDE },
    });
    if (!existing) throw new NotFoundException('Agenda item not found');
    assertCommitteeActive(existing.meeting.committee.status);
    if (existing.status === AgendaStatus.PUBLISHED) throw new BadRequestException('Published agenda items cannot be reviewed');
    await this.assertCanReview(existing.meeting.committeeId, user);

    const item = await this.prisma.agendaItem.update({
      where: { id: agendaId },
      data: { status: dto.decision as AgendaStatus, reviewComment: dto.reviewComment ?? null },
      include: SUBMITTER_INCLUDE,
    });

    await this.audit.log({
      userId: user.sub, action: 'REVIEW_AGENDA', resource: 'AgendaItem', resourceId: agendaId,
      oldValue: { status: existing.status }, newValue: { status: item.status, reviewComment: item.reviewComment },
    });
    // Notify the submitter of the outcome
    if (existing.submittedById) {
      await this.notifications.create({
        userId: existing.submittedById, type: NotificationType.SYSTEM, module: AppModule.NQAS,
        title: `Agenda ${item.status.toLowerCase().replace(/_/g, ' ')}`,
        message: `"${item.title}" was ${item.status.toLowerCase().replace(/_/g, ' ')}${item.reviewComment ? `: ${item.reviewComment}` : ''}`,
        meta: { committeeId: existing.meeting.committeeId, meetingId: existing.meetingId },
      });
    }
    return item;
  }

  async remove(agendaId: string, user: JwtPayload) {
    const existing = await this.prisma.agendaItem.findUnique({
      where: { id: agendaId }, include: { meeting: { select: { committee: { select: { status: true } } } } },
    });
    if (!existing) throw new NotFoundException('Agenda item not found');
    assertCommitteeActive(existing.meeting.committee.status);
    if (existing.status === AgendaStatus.PUBLISHED) throw new BadRequestException('Published agenda items cannot be deleted');
    if (user.role !== UserRole.ADMIN && existing.submittedById !== user.sub) {
      throw new ForbiddenException('Only the submitter (or an admin) can delete this agenda item');
    }
    await this.prisma.agendaItem.delete({ where: { id: agendaId } });
    await this.audit.log({ userId: user.sub, action: 'DELETE_AGENDA', resource: 'AgendaItem', resourceId: agendaId, oldValue: { title: existing.title } });
    return { message: 'Agenda item deleted' };
  }

  async publish(meetingId: string, user: JwtPayload) {
    const meeting = await this.ensureMeeting(meetingId);
    assertCommitteeActive(meeting.committee.status);
    await this.assertCanReview(meeting.committeeId, user);

    const accepted = await this.prisma.agendaItem.findMany({
      where: { meetingId, status: AgendaStatus.ACCEPTED }, select: { id: true },
    });
    if (accepted.length === 0) throw new BadRequestException('No accepted agenda items to publish');

    await this.prisma.agendaItem.updateMany({
      where: { meetingId, status: AgendaStatus.ACCEPTED },
      data: { status: AgendaStatus.PUBLISHED },
    });

    await this.audit.log({
      userId: user.sub, action: 'PUBLISH_AGENDA', resource: 'CommitteeMeeting', resourceId: meetingId,
      newValue: { published: accepted.length },
    });
    await this.notifyMembers(meeting.committeeId, 'Agenda published', `The agenda for an upcoming meeting has been published (${accepted.length} item${accepted.length !== 1 ? 's' : ''})`, { committeeId: meeting.committeeId, meetingId });
    return { published: accepted.length };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────--

  private async ensureMeeting(id: string) {
    const m = await this.prisma.committeeMeeting.findUnique({
      where: { id }, select: { id: true, committeeId: true, committee: { select: { status: true } } },
    });
    if (!m) throw new NotFoundException('Meeting not found');
    return m;
  }

  // Position-gated (FRS §5.2): only Chairperson / Member Secretary (canApprove) or an admin
  private async isApprover(committeeId: string, user: JwtPayload): Promise<boolean> {
    if (user.role === UserRole.ADMIN) return true;
    const member = await this.prisma.committeeMember.findFirst({
      where: { committeeId, isActive: true, userId: user.sub, positionType: { canApprove: true } },
      select: { id: true },
    });
    return !!member;
  }

  private async assertCanReview(committeeId: string, user: JwtPayload) {
    if (!(await this.isApprover(committeeId, user))) {
      throw new ForbiddenException('Only the Chairperson / Member Secretary (or an admin) may review or publish agenda');
    }
  }

  private async notifyMembers(committeeId: string, title: string, message: string, meta: Record<string, any>) {
    const members = await this.prisma.committeeMember.findMany({
      where: { committeeId, isActive: true, userId: { not: null } }, select: { userId: true },
    });
    const ids = [...new Set(members.map((m) => m.userId).filter((id): id is string => !!id))];
    await Promise.all(ids.map((uid) =>
      this.notifications.create({ userId: uid, type: NotificationType.SYSTEM, module: AppModule.NQAS, title, message, meta }),
    ));
  }

  private async notifyApprovers(committeeId: string, title: string, message: string, meta: Record<string, any>) {
    const approvers = await this.prisma.committeeMember.findMany({
      where: { committeeId, isActive: true, userId: { not: null }, positionType: { canApprove: true } },
      select: { userId: true },
    });
    const ids = [...new Set(approvers.map((m) => m.userId).filter((id): id is string => !!id))];
    await Promise.all(ids.map((uid) =>
      this.notifications.create({ userId: uid, type: NotificationType.SYSTEM, module: AppModule.NQAS, title, message, meta }),
    ));
  }
}
