import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateCommitteeDto, UpdateCommitteeDto, UpdateCommitteeStatusDto,
} from './dto/committee.dto';
import { AddMemberDto, UpdateMemberDto, RemoveMemberDto } from './dto/member.dto';
import { assertCommitteeActive } from './committee-active.util';
import {
  CreatePositionTypeDto, UpdatePositionTypeDto,
  CreateDesignationDto, UpdateDesignationDto,
} from './dto/catalog.dto';
import {
  AppModule, CommitteeStatus, MembershipType, MembershipChangeType,
  MeetingStatus, ActionStatus, AttendanceStatus,
} from '@nabh/shared';

const OPEN_ACTION_STATUSES = [
  ActionStatus.OPEN, ActionStatus.IN_PROGRESS, ActionStatus.PARTIALLY_COMPLETED, ActionStatus.OVERDUE,
];

const MEMBER_INCLUDE = {
  positionType: true,
  user: { select: { id: true, name: true, email: true } },
  designation: true,
  department: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class CommitteesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ─── Committees ─────────────────────────────────────────────────────────────

  async create(dto: CreateCommitteeDto, userId: string) {
    const committee = await this.prisma.committee.create({
      data: {
        name: dto.name,
        category: dto.category ?? null,
        type: dto.type ?? null,
        purpose: dto.purpose ?? null,
        frequency: dto.frequency ?? undefined,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        module: dto.module ?? AppModule.NQAS,
        createdById: userId,
      },
    });

    await this.audit.log({
      userId,
      action: 'CREATE_COMMITTEE',
      resource: 'Committee',
      resourceId: committee.id,
      newValue: { name: committee.name, category: committee.category, type: committee.type },
    });

    return committee;
  }

  async findAll(page = 1, limit = 20, filters: { status?: string; module?: string; q?: string } = {}) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.module) where.module = filters.module;
    if (filters.q) where.name = { contains: filters.q, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.committee.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true, meetings: true, actions: true } },
        },
      }),
      this.prisma.committee.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Committee dashboard metrics (FRS §10)
  async getStats(module?: string) {
    const now = new Date();
    const committeeWhere: any = module ? { module } : {};
    const meetingWhere: any = module ? { committee: { module } } : {};
    const actionWhere: any = module ? { committee: { module } } : {};
    const attendanceWhere: any = module ? { meeting: { committee: { module } } } : {};

    const [
      totalCommittees, activeCommittees, expiredCommittees,
      meetingsPlanned, meetingsConducted, meetingsCancelled, upcomingMeetings,
      openActions, overdueActions, closedActions,
      departmentGroups,
      attendanceTotal, attendancePresent,
    ] = await Promise.all([
      this.prisma.committee.count({ where: committeeWhere }),
      this.prisma.committee.count({ where: { ...committeeWhere, status: CommitteeStatus.ACTIVE } }),
      this.prisma.committee.count({ where: { ...committeeWhere, expiryDate: { lt: now } } }),
      this.prisma.committeeMeeting.count({ where: { ...meetingWhere, status: { not: MeetingStatus.CANCELLED } } }),
      this.prisma.committeeMeeting.count({ where: { ...meetingWhere, status: MeetingStatus.COMPLETED } }),
      this.prisma.committeeMeeting.count({ where: { ...meetingWhere, status: MeetingStatus.CANCELLED } }),
      this.prisma.committeeMeeting.count({
        where: { ...meetingWhere, status: { in: [MeetingStatus.SCHEDULED, MeetingStatus.RESCHEDULED] }, scheduledDate: { gte: now } },
      }),
      this.prisma.actionItem.count({ where: { ...actionWhere, status: { in: OPEN_ACTION_STATUSES } } }),
      this.prisma.actionItem.count({ where: { ...actionWhere, status: { in: OPEN_ACTION_STATUSES }, dueDate: { lt: now } } }),
      this.prisma.actionItem.count({ where: { ...actionWhere, status: ActionStatus.CLOSED } }),
      this.prisma.actionItem.groupBy({ by: ['department'], where: actionWhere, _count: { _all: true } }),
      this.prisma.meetingAttendance.count({ where: attendanceWhere }),
      this.prisma.meetingAttendance.count({ where: { ...attendanceWhere, status: AttendanceStatus.PRESENT } }),
    ]);

    const meetingsPending = meetingsPlanned - meetingsConducted;
    const departmentWise = departmentGroups
      .map((g) => ({ department: g.department ?? 'Unassigned', count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    return {
      overview: { totalCommittees, activeCommittees, upcomingMeetings, expiredCommittees },
      meetings: { planned: meetingsPlanned, conducted: meetingsConducted, pending: meetingsPending, cancelled: meetingsCancelled },
      actions: { open: openActions, overdue: overdueActions, closed: closedActions, departmentWise },
      attendance: {
        percentage: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0,
        present: attendancePresent,
        recorded: attendanceTotal,
      },
    };
  }

  async findOne(id: string) {
    const committee = await this.prisma.committee.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        members: {
          where: { isActive: true },
          orderBy: { positionType: { order: 'asc' } },
          include: MEMBER_INCLUDE,
        },
        _count: { select: { meetings: true, actions: true } },
      },
    });
    if (!committee) throw new NotFoundException('Committee not found');

    return {
      ...committee,
      members: await this.attachIncumbents(committee.members),
    };
  }

  async update(id: string, dto: UpdateCommitteeDto, userId: string) {
    const existing = await this.prisma.committee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Committee not found');
    assertCommitteeActive(existing.status);

    const committee = await this.prisma.committee.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        category: dto.category ?? undefined,
        type: dto.type ?? undefined,
        purpose: dto.purpose ?? undefined,
        frequency: dto.frequency ?? undefined,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_COMMITTEE',
      resource: 'Committee',
      resourceId: id,
      oldValue: { name: existing.name, category: existing.category, type: existing.type, purpose: existing.purpose },
      newValue: { name: committee.name, category: committee.category, type: committee.type, purpose: committee.purpose },
    });

    return committee;
  }

  async setStatus(id: string, dto: UpdateCommitteeStatusDto, userId: string) {
    const existing = await this.prisma.committee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Committee not found');

    const committee = await this.prisma.committee.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log({
      userId,
      action: dto.status === CommitteeStatus.ARCHIVED ? 'ARCHIVE_COMMITTEE' : 'UPDATE_COMMITTEE_STATUS',
      resource: 'Committee',
      resourceId: id,
      oldValue: { status: existing.status },
      newValue: { status: committee.status },
    });

    return committee;
  }

  async getHistory(id: string) {
    await this.ensureCommittee(id);
    return this.prisma.committeeMembershipHistory.findMany({
      where: { committeeId: id },
      orderBy: { createdAt: 'desc' },
      include: { changedBy: { select: { id: true, name: true, email: true } } },
    });
  }

  // ─── Members ──────────────────────────────────────────────────────────────--

  async listMembers(committeeId: string, includeInactive = false) {
    await this.ensureCommittee(committeeId);
    const members = await this.prisma.committeeMember.findMany({
      where: { committeeId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { positionType: { order: 'asc' } }],
      include: MEMBER_INCLUDE,
    });
    return this.attachIncumbents(members);
  }

  async addMember(committeeId: string, dto: AddMemberDto, userId: string) {
    const committee = await this.ensureCommittee(committeeId);
    assertCommitteeActive(committee.status);
    await this.validateMemberInput(dto.membershipType, dto.userId, dto.designationId);

    // No duplicate active members: the same person cannot hold two active seats.
    if (dto.userId) {
      const dup = await this.prisma.committeeMember.findFirst({
        where: { committeeId, userId: dto.userId, isActive: true },
        include: { user: { select: { name: true } } },
      });
      if (dup) {
        throw new ConflictException(
          `${dup.user?.name ?? 'This person'} is already an active member of this committee`,
        );
      }
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.committeeMember.create({
        data: {
          committeeId,
          positionTypeId: dto.positionTypeId,
          membershipType: dto.membershipType,
          userId: dto.userId ?? null,
          designationId: dto.designationId ?? null,
          departmentId: dto.departmentId ?? null,
          nomineeName: dto.nomineeName ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
        include: MEMBER_INCLUDE,
      });

      await tx.committeeMembershipHistory.create({
        data: {
          committeeId,
          memberId: created.id,
          changeType: MembershipChangeType.ADDED,
          newValue: this.snapshot(created),
          changedById: userId,
          changeReason: dto.changeReason ?? null,
        },
      });

      return created;
    });

    await this.audit.log({
      userId,
      action: 'ADD_COMMITTEE_MEMBER',
      resource: 'CommitteeMember',
      resourceId: member.id,
      newValue: this.snapshot(member),
    });

    return member;
  }

  async updateMember(committeeId: string, memberId: string, dto: UpdateMemberDto, userId: string) {
    const existing = await this.prisma.committeeMember.findFirst({
      where: { id: memberId, committeeId },
      include: { ...MEMBER_INCLUDE, committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Committee member not found');
    assertCommitteeActive(existing.committee.status);

    const membershipType = dto.membershipType ?? existing.membershipType;
    const userIdNext = dto.userId !== undefined ? dto.userId : existing.userId;
    const designationIdNext = dto.designationId !== undefined ? dto.designationId : existing.designationId;
    await this.validateMemberInput(membershipType, userIdNext, designationIdNext);

    // No duplicate active members when reassigning this seat to another person.
    if (userIdNext && userIdNext !== existing.userId) {
      const dup = await this.prisma.committeeMember.findFirst({
        where: { committeeId, userId: userIdNext, isActive: true, id: { not: memberId } },
        include: { user: { select: { name: true } } },
      });
      if (dup) {
        throw new ConflictException(
          `${dup.user?.name ?? 'This person'} is already an active member of this committee`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.committeeMember.update({
        where: { id: memberId },
        data: {
          positionTypeId: dto.positionTypeId ?? undefined,
          membershipType: dto.membershipType ?? undefined,
          userId: dto.userId !== undefined ? dto.userId : undefined,
          designationId: dto.designationId !== undefined ? dto.designationId : undefined,
          departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
          nomineeName: dto.nomineeName !== undefined ? dto.nomineeName : undefined,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          isActive: dto.isActive ?? undefined,
        },
        include: MEMBER_INCLUDE,
      });

      // Classify the change for history (FRS §3.4)
      const roleChanged = dto.positionTypeId && dto.positionTypeId !== existing.positionTypeId;
      const personChanged =
        (dto.userId !== undefined && dto.userId !== existing.userId) ||
        (dto.designationId !== undefined && dto.designationId !== existing.designationId);
      const changeType = roleChanged
        ? MembershipChangeType.ROLE_CHANGED
        : personChanged
          ? MembershipChangeType.REPLACED
          : MembershipChangeType.ROLE_CHANGED; // generic field edit recorded as role/detail change

      await tx.committeeMembershipHistory.create({
        data: {
          committeeId,
          memberId,
          changeType,
          previousValue: this.snapshot(existing),
          newValue: this.snapshot(next),
          changedById: userId,
          changeReason: dto.changeReason ?? null,
        },
      });

      return next;
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_COMMITTEE_MEMBER',
      resource: 'CommitteeMember',
      resourceId: memberId,
      oldValue: this.snapshot(existing),
      newValue: this.snapshot(updated),
    });

    return updated;
  }

  async removeMember(committeeId: string, memberId: string, dto: RemoveMemberDto, userId: string) {
    const existing = await this.prisma.committeeMember.findFirst({
      where: { id: memberId, committeeId },
      include: { ...MEMBER_INCLUDE, committee: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Committee member not found');
    assertCommitteeActive(existing.committee.status);
    if (!existing.isActive) throw new BadRequestException('Member is already inactive');

    // Soft-remove: deactivate + close tenure, preserve the record (history is immutable)
    const removed = await this.prisma.$transaction(async (tx) => {
      const next = await tx.committeeMember.update({
        where: { id: memberId },
        data: { isActive: false, endDate: existing.endDate ?? new Date() },
        include: MEMBER_INCLUDE,
      });

      await tx.committeeMembershipHistory.create({
        data: {
          committeeId,
          memberId,
          changeType: MembershipChangeType.REMOVED,
          previousValue: this.snapshot(existing),
          changedById: userId,
          changeReason: dto.changeReason ?? null,
        },
      });

      return next;
    });

    await this.audit.log({
      userId,
      action: 'REMOVE_COMMITTEE_MEMBER',
      resource: 'CommitteeMember',
      resourceId: memberId,
      oldValue: this.snapshot(existing),
    });

    return removed;
  }

  // ─── Position types (catalog) ─────────────────────────────────────────────--

  listPositionTypes() {
    return this.prisma.committeePositionType.findMany({ orderBy: { order: 'asc' } });
  }

  async createPositionType(dto: CreatePositionTypeDto, userId: string) {
    const created = await this.prisma.committeePositionType.create({
      data: {
        name: dto.name,
        order: dto.order ?? 0,
        isLeadership: dto.isLeadership ?? false,
        canApprove: dto.canApprove ?? false,
      },
    });
    await this.audit.log({ userId, action: 'CREATE_POSITION_TYPE', resource: 'CommitteePositionType', resourceId: created.id, newValue: { name: created.name } });
    return created;
  }

  async updatePositionType(id: string, dto: UpdatePositionTypeDto, userId: string) {
    const existing = await this.prisma.committeePositionType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Position type not found');
    const updated = await this.prisma.committeePositionType.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        order: dto.order ?? undefined,
        isLeadership: dto.isLeadership ?? undefined,
        canApprove: dto.canApprove ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    await this.audit.log({ userId, action: 'UPDATE_POSITION_TYPE', resource: 'CommitteePositionType', resourceId: id, oldValue: { ...existing }, newValue: { ...updated } });
    return updated;
  }

  // ─── Designations (catalog) ───────────────────────────────────────────────--

  listDesignations(includeInactive = false) {
    return this.prisma.designation.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createDesignation(dto: CreateDesignationDto, userId: string) {
    const dupe = await this.prisma.designation.findUnique({ where: { code: dto.code } });
    if (dupe) throw new BadRequestException(`Designation code "${dto.code}" already exists`);
    const created = await this.prisma.designation.create({ data: { name: dto.name, code: dto.code } });
    await this.audit.log({ userId, action: 'CREATE_DESIGNATION', resource: 'Designation', resourceId: created.id, newValue: { name: created.name, code: created.code } });
    return created;
  }

  async updateDesignation(id: string, dto: UpdateDesignationDto, userId: string) {
    const existing = await this.prisma.designation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Designation not found');
    if (dto.code && dto.code !== existing.code) {
      const dupe = await this.prisma.designation.findUnique({ where: { code: dto.code } });
      if (dupe) throw new BadRequestException(`Designation code "${dto.code}" already exists`);
    }
    const updated = await this.prisma.designation.update({
      where: { id },
      data: { name: dto.name ?? undefined, code: dto.code ?? undefined, isActive: dto.isActive ?? undefined },
    });
    await this.audit.log({ userId, action: 'UPDATE_DESIGNATION', resource: 'Designation', resourceId: id, oldValue: { ...existing }, newValue: { ...updated } });
    return updated;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────--

  private async ensureCommittee(id: string) {
    const committee = await this.prisma.committee.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!committee) throw new NotFoundException('Committee not found');
    return committee;
  }

  private async validateMemberInput(type: string, userId?: string | null, designationId?: string | null) {
    if (type === MembershipType.NOMINATION && !userId) {
      throw new BadRequestException('Nomination-based membership requires a user');
    }
    if (type === MembershipType.DESIGNATION && !designationId) {
      throw new BadRequestException('Designation-based membership requires a designation');
    }
    if (type === MembershipType.DESIGNATION && !userId) {
      throw new BadRequestException('Designation-based membership requires selecting a holder');
    }
  }

  // For designation-based members, resolve the current incumbent(s):
  // active users currently linked to that designation (FRS §3.3A).
  private async attachIncumbents<T extends { membershipType: string; designationId: string | null }>(members: T[]) {
    const designationIds = [
      ...new Set(members.filter((m) => m.membershipType === MembershipType.DESIGNATION && m.designationId).map((m) => m.designationId as string)),
    ];
    if (designationIds.length === 0) {
      return members.map((m) => ({ ...m, incumbents: [] as { id: string; name: string; email: string }[] }));
    }

    const users = await this.prisma.user.findMany({
      where: { designations: { some: { id: { in: designationIds } } }, isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true, designations: { select: { id: true } } },
    });
    const wanted = new Set(designationIds);
    const byDesignation = new Map<string, { id: string; name: string; email: string }[]>();
    for (const u of users) {
      // A user may hold several titles — index them under every designation they hold that we care about.
      for (const d of u.designations) {
        if (!wanted.has(d.id)) continue;
        const list = byDesignation.get(d.id) ?? [];
        list.push({ id: u.id, name: u.name, email: u.email });
        byDesignation.set(d.id, list);
      }
    }

    return members.map((m) => ({
      ...m,
      incumbents: m.membershipType === MembershipType.DESIGNATION && m.designationId
        ? byDesignation.get(m.designationId) ?? []
        : [],
    }));
  }

  private snapshot(m: any): Record<string, any> {
    return {
      positionTypeId: m.positionTypeId,
      position: m.positionType?.name ?? null,
      membershipType: m.membershipType,
      userId: m.userId,
      userName: m.user?.name ?? null,
      designationId: m.designationId,
      designation: m.designation?.name ?? null,
      departmentId: m.departmentId,
      nomineeName: m.nomineeName,
      isActive: m.isActive,
    };
  }
}
