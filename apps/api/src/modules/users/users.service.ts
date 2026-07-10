import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dto/users.dto';
import { UserRole } from '@nabh/shared';

const USER_SELECT = {
  id: true, email: true, name: true, role: true, isActive: true,
  phone: true, designation: true, department: true, avatarUrl: true,
  designations: { select: { id: true, name: true }, orderBy: { name: 'asc' as const } },
  moduleAccess: true, lastLoginAt: true, createdAt: true, updatedAt: true,
};

/**
 * Pull `designationIds` (multi-title) out of the DTO and translate it into a
 * Prisma many-to-many relation write, leaving the rest of the scalar fields intact.
 * `connect` on create (nothing to replace); `set` on update (replaces the full list).
 */
function buildUserData<T extends { designationIds?: string[] }>(dto: T, mode: 'create' | 'update') {
  const { designationIds, ...rest } = dto;
  if (designationIds === undefined) return rest;
  const links = designationIds.map((id) => ({ id }));
  return {
    ...rest,
    designations: mode === 'create' ? { connect: links } : { set: links },
  };
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(page = 1, limit = 20, search?: string, role?: UserRole) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
    if (role) where.role = role;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null }, select: USER_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const password = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({ data: { ...buildUserData(dto, 'create'), password }, select: USER_SELECT });
    await this.audit.log({ userId: actorId, action: 'CREATE_USER', resource: 'User', resourceId: user.id, newValue: { email: user.email, role: user.role } });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const existing = await this.findOne(id);
    if (dto.email && dto.email !== existing.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (dup) throw new ConflictException('Email already in use');
    }
    const updated = await this.prisma.user.update({ where: { id }, data: buildUserData(dto, 'update'), select: USER_SELECT });
    await this.audit.log({ userId: actorId, action: 'UPDATE_USER', resource: 'User', resourceId: id, oldValue: existing as any, newValue: dto });
    return updated;
  }

  async deactivate(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    await this.audit.log({ userId: actorId, action: 'DEACTIVATE_USER', resource: 'User', resourceId: id });
    return { message: 'User deactivated' };
  }

  async findNames() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, designation: true, designations: { select: { id: true } } },
      orderBy: { name: 'asc' },
    });
    return users.map(({ designations, ...u }) => ({
      ...u,
      designationIds: designations.map((d) => d.id),
    }));
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: USER_SELECT,
    });
    return user;
  }
}
