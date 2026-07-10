import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';

/**
 * Substitute `{{placeholder}}` tokens in a template string with the given
 * variables. Unknown tokens are left as-is so missing data is visible rather
 * than silently blanked. Whitespace inside the braces is tolerated.
 */
export function renderTemplate(input: string, vars: Record<string, string | null | undefined>): string {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? match : String(v);
  });
}

@Injectable()
export class EmailTemplatesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(category?: string, activeOnly = false) {
    return this.prisma.emailTemplate.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Email template not found');
    return template;
  }

  async create(dto: CreateEmailTemplateDto, userId: string) {
    const template = await this.prisma.emailTemplate.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        subject: dto.subject,
        body: dto.body,
        category: dto.category ?? 'MEETING_REMINDER',
        isActive: dto.isActive ?? true,
        createdById: userId,
      },
    });
    await this.audit.log({
      userId, action: 'CREATE_EMAIL_TEMPLATE', resource: 'EmailTemplate', resourceId: template.id,
      newValue: { name: template.name, category: template.category },
    });
    return template;
  }

  async update(id: string, dto: UpdateEmailTemplateDto, userId: string) {
    await this.findOne(id);
    const template = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        subject: dto.subject ?? undefined,
        body: dto.body ?? undefined,
        category: dto.category ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    await this.audit.log({
      userId, action: 'UPDATE_EMAIL_TEMPLATE', resource: 'EmailTemplate', resourceId: id,
      newValue: { name: template.name, category: template.category, isActive: template.isActive },
    });
    return template;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    // Meetings reference templates with onDelete: SetNull, so this is safe.
    const inUse = await this.prisma.committeeMeeting.count({ where: { reminderTemplateId: id } });
    await this.prisma.emailTemplate.delete({ where: { id } });
    await this.audit.log({
      userId, action: 'DELETE_EMAIL_TEMPLATE', resource: 'EmailTemplate', resourceId: id,
      newValue: { detachedFromMeetings: inUse },
    });
    return { success: true, detachedFromMeetings: inUse };
  }
}
