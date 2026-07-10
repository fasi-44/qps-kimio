import {
  Controller, Get, Delete, Query, Res, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@nabh/shared';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get audit logs (Admin only)' })
  async getLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const skip = (+page - 1) * +limit;
    const where: any = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.userId = userId;
    if (resource) where.resource = { contains: resource, mode: 'insensitive' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: +limit,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) };
  }

  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export audit logs as CSV (Admin only)' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async exportCsv(
    @Res() res: Response,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: any = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.userId = userId;
    if (resource) where.resource = { contains: resource, mode: 'insensitive' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
    });

    const header = 'Timestamp,User,Email,Role,Action,Resource,Resource ID,IP Address\r\n';
    const rows = logs.map((l) => {
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      return [
        escape(new Date(l.createdAt).toISOString()),
        escape(l.user?.name ?? ''),
        escape(l.user?.email ?? ''),
        escape(l.user?.role ?? ''),
        escape(l.action),
        escape(l.resource),
        escape(l.resourceId ?? ''),
        escape(l.ipAddress ?? ''),
      ].join(',');
    });

    const csv = header + rows.join('\r\n');
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Delete('purge')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Purge audit logs older than a given date (Admin only)' })
  @ApiQuery({ name: 'before', required: true, description: 'ISO date — logs created before this date will be deleted' })
  async purge(@Query('before') before?: string) {
    if (!before) throw new BadRequestException('Query param "before" is required');
    const cutoff = new Date(before);
    if (isNaN(cutoff.getTime())) throw new BadRequestException('"before" must be a valid date');

    const { count } = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return { message: `Deleted ${count} audit log(s) created before ${cutoff.toISOString()}`, count };
  }
}
