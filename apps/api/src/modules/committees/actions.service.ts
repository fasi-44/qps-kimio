import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateActionDto, UpdateActionDto, UpdateActionStatusDto, AddEvidenceDto,
  CloseReopenDto, CarryForwardDto,
} from './dto/action.dto';
import {
  ActionStatus, ActionPriority, CarryForwardDecision, NotificationType, AppModule, UserRole, JwtPayload,
} from '@nabh/shared';
import { assertCommitteeActive } from './committee-active.util';

const OPEN_STATUSES = [
  ActionStatus.OPEN, ActionStatus.IN_PROGRESS, ActionStatus.PARTIALLY_COMPLETED, ActionStatus.OVERDUE,
];
const ACTION_INCLUDE = {
  responsibleUser: { select: { id: true, name: true, email: true } },
  meeting: { select: { id: true, title: true, scheduledDate: true } },
} as const;

@Injectable()
export class ActionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async list(committeeId: string, filters: { status?: string; meetingId?: string; overdueOnly?: boolean } = {}) {
    await this.ensureCommittee(committeeId);
    const where: any = { committeeId };
    if (filters.status) where.status = filters.status;
    if (filters.meetingId) where.meetingId = filters.meetingId;
    const actions = await this.prisma.actionItem.findMany({
      where, orderBy: { createdAt: 'desc' }, include: ACTION_INCLUDE,
    });
    const derived = actions.map((a) => this.deriveOverdue(a));
    return filters.overdueOnly ? derived.filter((a) => a.isOverdue) : derived;
  }

  // Actions raised in this meeting + still-open items carried forward from elsewhere (FRS §9)
  async listForMeeting(meetingId: string) {
    const meeting = await this.prisma.committeeMeeting.findUnique({
      where: { id: meetingId }, select: { id: true, committeeId: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const [raised, carriedForward] = await Promise.all([
      this.prisma.actionItem.findMany({ where: { meetingId }, orderBy: { createdAt: 'desc' }, include: ACTION_INCLUDE }),
      this.prisma.actionItem.findMany({
        where: { committeeId: meeting.committeeId, status: { in: OPEN_STATUSES }, NOT: { meetingId } },
        orderBy: { dueDate: 'asc' }, include: ACTION_INCLUDE,
      }),
    ]);
    return {
      raised: raised.map((a) => this.deriveOverdue(a)),
      carriedForward: carriedForward.map((a) => this.deriveOverdue(a)),
    };
  }

  async findOne(id: string) {
    const action = await this.prisma.actionItem.findUnique({
      where: { id },
      include: { ...ACTION_INCLUDE, carryForwards: { orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { id: true, name: true } } } } },
    });
    if (!action) throw new NotFoundException('Action item not found');
    return this.deriveOverdue(action);
  }

  async create(committeeId: string, dto: CreateActionDto, user: JwtPayload) {
    const committee = await this.ensureCommittee(committeeId);
    assertCommitteeActive(committee.status);
    const seq = (await this.prisma.actionItem.count()) + 1;
    const actionCode = `ACT-${String(seq).padStart(4, '0')}`;

    const action = await this.prisma.actionItem.create({
      data: {
        actionCode,
        description: dto.description,
        committeeId,
        meetingId: dto.meetingId ?? null,
        agendaItemId: dto.agendaItemId ?? null,
        source: dto.source ?? undefined,
        responsibleUserId: dto.responsibleUserId ?? null,
        department: dto.department ?? null,
        priority: dto.priority ?? undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        targetCompletionDate: dto.targetCompletionDate ? new Date(dto.targetCompletionDate) : null,
        remarks: dto.remarks ?? null,
      },
      include: ACTION_INCLUDE,
    });

    await this.audit.log({
      userId: user.sub, action: 'CREATE_ACTION', resource: 'ActionItem', resourceId: action.id,
      newValue: { actionCode, description: dto.description, committeeId },
    });
    if (action.responsibleUserId) {
      await this.notifications.create({
        userId: action.responsibleUserId, type: NotificationType.SYSTEM, module: AppModule.NQAS,
        title: 'Action item assigned', message: `${actionCode}: ${dto.description}`,
        meta: { committeeId, meetingId: dto.meetingId, actionId: action.id },
      });
    }
    return this.deriveOverdue(action);
  }

  async update(id: string, dto: UpdateActionDto, user: JwtPayload) {
    const existing = await this.prisma.actionItem.findUnique({
      where: { id }, include: { committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Action item not found');
    assertCommitteeActive(existing.committee.status);

    const action = await this.prisma.actionItem.update({
      where: { id },
      data: {
        description: dto.description ?? undefined,
        responsibleUserId: dto.responsibleUserId !== undefined ? dto.responsibleUserId : undefined,
        department: dto.department !== undefined ? dto.department : undefined,
        priority: dto.priority ?? undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        targetCompletionDate: dto.targetCompletionDate ? new Date(dto.targetCompletionDate) : undefined,
        remarks: dto.remarks !== undefined ? dto.remarks : undefined,
      },
      include: ACTION_INCLUDE,
    });
    await this.audit.log({
      userId: user.sub, action: 'UPDATE_ACTION', resource: 'ActionItem', resourceId: id,
      oldValue: { description: existing.description, priority: existing.priority }, newValue: { description: action.description, priority: action.priority },
    });
    return this.deriveOverdue(action);
  }

  async remove(id: string, user: JwtPayload) {
    const existing = await this.prisma.actionItem.findUnique({
      where: { id }, include: { committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Action item not found');
    assertCommitteeActive(existing.committee.status);

    // Carry-forward history cascades (ActionCarryForward.action onDelete: Cascade).
    await this.prisma.actionItem.delete({ where: { id } });
    await this.audit.log({
      userId: user.sub, action: 'DELETE_ACTION', resource: 'ActionItem', resourceId: id,
      oldValue: { actionCode: existing.actionCode, description: existing.description, status: existing.status },
    });
    return { message: 'Action item deleted' };
  }

  async updateStatus(id: string, dto: UpdateActionStatusDto, user: JwtPayload) {
    const existing = await this.prisma.actionItem.findUnique({
      where: { id }, include: { committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Action item not found');
    assertCommitteeActive(existing.committee.status);
    if (existing.status === ActionStatus.CLOSED) throw new BadRequestException('Closed actions cannot be updated; reopen first');
    await this.assertResponsibleOrManager(existing.responsibleUserId, user);

    const action = await this.prisma.actionItem.update({
      where: { id },
      data: { status: dto.status as ActionStatus, remarks: dto.remarks !== undefined ? dto.remarks : undefined },
      include: ACTION_INCLUDE,
    });
    await this.audit.log({
      userId: user.sub, action: 'UPDATE_ACTION_STATUS', resource: 'ActionItem', resourceId: id,
      oldValue: { status: existing.status }, newValue: { status: action.status },
    });
    return this.deriveOverdue(action);
  }

  async addEvidence(id: string, dto: AddEvidenceDto, user: JwtPayload) {
    const existing = await this.prisma.actionItem.findUnique({
      where: { id }, include: { committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Action item not found');
    assertCommitteeActive(existing.committee.status);
    await this.assertResponsibleOrManager(existing.responsibleUserId, user);

    const action = await this.prisma.actionItem.update({
      where: { id },
      data: { evidenceUrls: { set: [...existing.evidenceUrls, ...dto.evidenceUrls] } },
      include: ACTION_INCLUDE,
    });
    await this.audit.log({
      userId: user.sub, action: 'ADD_ACTION_EVIDENCE', resource: 'ActionItem', resourceId: id,
      newValue: { added: dto.evidenceUrls.length },
    });
    return this.deriveOverdue(action);
  }

  async close(id: string, dto: CloseReopenDto, user: JwtPayload) {
    const existing = await this.prisma.actionItem.findUnique({
      where: { id }, include: { committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Action item not found');
    assertCommitteeActive(existing.committee.status);
    if (existing.status === ActionStatus.CLOSED) throw new BadRequestException('Action is already closed');
    await this.assertCanApprove(existing.committeeId, user);

    const action = await this.prisma.actionItem.update({
      where: { id }, data: { status: ActionStatus.CLOSED, closedById: user.sub }, include: ACTION_INCLUDE,
    });
    await this.audit.log({
      userId: user.sub, action: 'CLOSE_ACTION', resource: 'ActionItem', resourceId: id,
      oldValue: { status: existing.status }, newValue: { status: 'CLOSED', comment: dto.comment },
    });
    if (action.responsibleUserId) {
      await this.notifications.create({
        userId: action.responsibleUserId, type: NotificationType.SYSTEM, module: AppModule.NQAS,
        title: 'Action closed', message: `${action.actionCode} has been closed`,
        meta: { committeeId: action.committeeId, actionId: id },
      });
    }
    return this.deriveOverdue(action);
  }

  async reopen(id: string, dto: CloseReopenDto, user: JwtPayload) {
    const existing = await this.prisma.actionItem.findUnique({
      where: { id }, include: { committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Action item not found');
    assertCommitteeActive(existing.committee.status);
    if (existing.status !== ActionStatus.CLOSED) throw new BadRequestException('Only closed actions can be reopened');
    await this.assertCanApprove(existing.committeeId, user);

    const action = await this.prisma.actionItem.update({
      where: { id },
      data: { status: ActionStatus.IN_PROGRESS, closedById: null, reopenedCount: { increment: 1 } },
      include: ACTION_INCLUDE,
    });
    await this.audit.log({
      userId: user.sub, action: 'REOPEN_ACTION', resource: 'ActionItem', resourceId: id,
      oldValue: { status: 'CLOSED' }, newValue: { status: action.status, comment: dto.comment },
    });
    return this.deriveOverdue(action);
  }

  async carryForward(id: string, dto: CarryForwardDto, user: JwtPayload) {
    const existing = await this.prisma.actionItem.findUnique({
      where: { id }, include: { committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Action item not found');
    assertCommitteeActive(existing.committee.status);
    await this.assertCanApprove(existing.committeeId, user);
    if (dto.decision === CarryForwardDecision.MODIFY_DUE_DATE && !dto.newDueDate) {
      throw new BadRequestException('MODIFY_DUE_DATE requires newDueDate');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.actionCarryForward.create({
        data: {
          actionId: id,
          fromMeetingId: existing.meetingId,
          toMeetingId: dto.toMeetingId ?? null,
          decision: dto.decision,
          newDueDate: dto.newDueDate ? new Date(dto.newDueDate) : null,
          createdById: user.sub,
        },
      });

      // Apply the decision's effect on the action
      const data: any = {};
      if (dto.decision === CarryForwardDecision.MODIFY_DUE_DATE) data.dueDate = new Date(dto.newDueDate!);
      if (dto.decision === CarryForwardDecision.ESCALATE) data.priority = this.escalate(existing.priority);
      if (dto.decision === CarryForwardDecision.CLOSE) { data.status = ActionStatus.CLOSED; data.closedById = user.sub; }
      if (dto.toMeetingId) data.meetingId = dto.toMeetingId;

      return tx.actionItem.update({ where: { id }, data, include: ACTION_INCLUDE });
    });

    await this.audit.log({
      userId: user.sub, action: 'CARRY_FORWARD_ACTION', resource: 'ActionItem', resourceId: id,
      newValue: { decision: dto.decision, toMeetingId: dto.toMeetingId, newDueDate: dto.newDueDate },
    });
    return this.deriveOverdue(result);
  }

  getCarryForwards(id: string) {
    return this.prisma.actionCarryForward.findMany({
      where: { actionId: id }, orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } }, fromMeeting: { select: { id: true, title: true } }, toMeeting: { select: { id: true, title: true } } },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────--

  private deriveOverdue<T extends { status: string; dueDate: Date | null }>(a: T) {
    const open = !([ActionStatus.COMPLETED, ActionStatus.CLOSED] as string[]).includes(a.status);
    const isOverdue = !!(open && a.dueDate && new Date(a.dueDate).getTime() < Date.now());
    const daysOverdue = isOverdue ? Math.floor((Date.now() - new Date(a.dueDate as Date).getTime()) / 86_400_000) : 0;
    return { ...a, isOverdue, daysOverdue };
  }

  private escalate(p: string): ActionPriority {
    const order = [ActionPriority.LOW, ActionPriority.MEDIUM, ActionPriority.HIGH, ActionPriority.CRITICAL];
    const idx = order.indexOf(p as ActionPriority);
    return order[Math.min(idx + 1, order.length - 1)] ?? ActionPriority.HIGH;
  }

  private async ensureCommittee(id: string) {
    const c = await this.prisma.committee.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!c) throw new NotFoundException('Committee not found');
    return c;
  }

  private async assertResponsibleOrManager(responsibleUserId: string | null, user: JwtPayload) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.HOD) return;
    if (responsibleUserId && responsibleUserId === user.sub) return;
    throw new ForbiddenException('Only the responsible person or a committee manager may update this action');
  }

  private async assertCanApprove(committeeId: string, user: JwtPayload) {
    if (user.role === UserRole.ADMIN) return;
    const member = await this.prisma.committeeMember.findFirst({
      where: { committeeId, isActive: true, userId: user.sub, positionType: { canApprove: true } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Only the Chairperson / Committee Secretary (or an admin) may review, close or carry forward actions');
  }
}
