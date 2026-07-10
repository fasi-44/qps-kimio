import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { computeIndicator } from './compute';
import { computeFromSpec, validateSpec, validateInputs, validateResult, type FormulaSpec } from '@nabh/shared';
import {
  CreateIndicatorTypeDto, UpdateIndicatorTypeDto,
  CreateIndicatorTemplateDto, UpdateIndicatorTemplateDto,
  UpsertIndicatorEntryDto, PreviewComputeDto,
} from './dto/indicator.dto';

@Injectable()
export class IndicatorsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ─── Types ─────────────────────────────────────────────────────────────────

  async listTypes(framework?: string, departmentCode?: string, activeOnly = false) {
    return this.prisma.indicatorType.findMany({
      where: {
        ...(framework ? { framework: framework as any } : {}),
        ...(departmentCode !== undefined ? { departmentCode } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ framework: 'asc' }, { departmentCode: 'asc' }, { order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { templates: true } } },
    });
  }

  async createType(dto: CreateIndicatorTypeDto, userId: string) {
    const departmentCode = dto.departmentCode ?? '';
    const existing = await this.prisma.indicatorType.findUnique({
      where: { framework_departmentCode_name: { framework: dto.framework as any, departmentCode, name: dto.name } },
    });
    if (existing) {
      const where = departmentCode ? ` for ${dto.departmentName ?? departmentCode}` : '';
      throw new ConflictException(`Type "${dto.name}" already exists under ${dto.framework}${where}`);
    }

    const type = await this.prisma.indicatorType.create({
      data: {
        framework: dto.framework as any,
        departmentCode,
        departmentName: dto.departmentName ?? null,
        name: dto.name,
        description: dto.description ?? null,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      userId, action: 'CREATE_INDICATOR_TYPE', resource: 'IndicatorType', resourceId: type.id,
      newValue: { framework: type.framework, departmentCode, name: type.name },
    });
    return type;
  }

  async updateType(id: string, dto: UpdateIndicatorTypeDto, userId: string) {
    await this.getType(id);
    const type = await this.prisma.indicatorType.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        order: dto.order ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    await this.audit.log({
      userId, action: 'UPDATE_INDICATOR_TYPE', resource: 'IndicatorType', resourceId: id,
      newValue: { name: type.name, isActive: type.isActive },
    });
    return type;
  }

  async removeType(id: string, userId: string) {
    await this.getType(id);
    const templateCount = await this.prisma.indicatorTemplate.count({ where: { typeId: id } });
    if (templateCount > 0) {
      throw new BadRequestException(
        `Cannot delete: this type still has ${templateCount} indicator(s). Move or delete them first, or deactivate the type instead.`,
      );
    }
    await this.prisma.indicatorType.delete({ where: { id } });
    await this.audit.log({ userId, action: 'DELETE_INDICATOR_TYPE', resource: 'IndicatorType', resourceId: id });
    return { success: true };
  }

  private async getType(id: string) {
    const type = await this.prisma.indicatorType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException('Indicator type not found');
    return type;
  }

  // ─── Templates ───────────────────────────────────────────────────────────────

  async listTemplates(filter: {
    framework?: string; typeId?: string; departmentCode?: string; activeOnly?: boolean;
  }) {
    // Constraints that apply to the parent Type. When activeOnly is set we also
    // require the *type* to be active, so deactivating a whole Type in Setup
    // hides all of its indicators from the Admin data-entry screen too.
    const typeWhere: any = {
      ...(filter.framework ? { framework: filter.framework as any } : {}),
      ...(filter.activeOnly ? { isActive: true } : {}),
    };
    return this.prisma.indicatorTemplate.findMany({
      where: {
        ...(filter.typeId ? { typeId: filter.typeId } : {}),
        ...(filter.departmentCode ? { departmentCode: filter.departmentCode } : {}),
        ...(filter.activeOnly ? { isActive: true } : {}),
        ...(Object.keys(typeWhere).length ? { type: typeWhere } : {}),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { type: { select: { id: true, name: true, framework: true, departmentCode: true, departmentName: true, order: true } } },
    });
  }

  async getTemplate(id: string) {
    const t = await this.prisma.indicatorTemplate.findUnique({
      where: { id },
      include: { type: { select: { id: true, name: true, framework: true, departmentCode: true, departmentName: true, order: true } } },
    });
    if (!t) throw new NotFoundException('Indicator template not found');
    return t;
  }

  // A template's scope + department are derived from its type (the single source
  // of truth) so they can never drift out of sync — client-sent values are ignored.
  private deptFieldsFromType(type: { framework: string; departmentCode: string; departmentName: string | null }) {
    const isOutcome = type.framework === 'OUTCOME';
    return {
      scope: (isOutcome ? 'DEPARTMENT' : 'HOSPITAL') as any,
      departmentCode: isOutcome ? (type.departmentCode || null) : null,
      departmentName: isOutcome ? (type.departmentName ?? null) : null,
    };
  }

  async createTemplate(dto: CreateIndicatorTemplateDto, userId: string) {
    const type = await this.getType(dto.typeId);
    if (dto.formulaSpec) {
      const v = validateSpec(dto.formulaSpec);
      if (!v.ok) throw new BadRequestException(`Invalid formula: ${v.error}`);
    }
    const template = await this.prisma.indicatorTemplate.create({
      data: {
        typeId: dto.typeId,
        name: dto.name,
        numeratorLabel: dto.numeratorLabel ?? null,
        denominatorLabel: dto.denominatorLabel ?? null,
        formulaType: (dto.formulaType ?? 'RATIO') as any,
        multiplier: dto.multiplier ?? 1,
        customExpression: dto.customExpression ?? null,
        formula: dto.formula ?? null,
        formulaSpec: (dto.formulaSpec ?? undefined) as any,
        unit: dto.unit ?? null,
        frequency: dto.frequency ?? null,
        sourceOfData: dto.sourceOfData ?? null,
        significance: dto.significance ?? null,
        target: dto.target ?? null,
        higherIsBetter: dto.higherIsBetter ?? true,
        ...this.deptFieldsFromType(type),   // scope + department derived from the type
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        createdById: userId,
      },
    });
    await this.audit.log({
      userId, action: 'CREATE_INDICATOR_TEMPLATE', resource: 'IndicatorTemplate', resourceId: template.id,
      newValue: { name: template.name, formulaType: template.formulaType },
    });
    return template;
  }

  async updateTemplate(id: string, dto: UpdateIndicatorTemplateDto, userId: string) {
    const existing = await this.getTemplate(id);
    if (dto.formulaSpec) {
      const v = validateSpec(dto.formulaSpec);
      if (!v.ok) throw new BadRequestException(`Invalid formula: ${v.error}`);
    }
    // Re-derive department from the (possibly new) type so it always stays in sync.
    const type = dto.typeId ? await this.getType(dto.typeId) : existing.type;
    const template = await this.prisma.indicatorTemplate.update({
      where: { id },
      data: {
        typeId: dto.typeId ?? undefined,
        name: dto.name ?? undefined,
        numeratorLabel: dto.numeratorLabel ?? undefined,
        denominatorLabel: dto.denominatorLabel ?? undefined,
        formulaType: (dto.formulaType ?? undefined) as any,
        multiplier: dto.multiplier ?? undefined,
        customExpression: dto.customExpression ?? undefined,
        formula: dto.formula ?? undefined,
        formulaSpec: (dto.formulaSpec ?? undefined) as any,
        unit: dto.unit ?? undefined,
        frequency: dto.frequency ?? undefined,
        sourceOfData: dto.sourceOfData ?? undefined,
        significance: dto.significance ?? undefined,
        target: dto.target ?? undefined,
        higherIsBetter: dto.higherIsBetter ?? undefined,
        ...this.deptFieldsFromType(type),   // scope + department always match the type
        order: dto.order ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    await this.audit.log({
      userId, action: 'UPDATE_INDICATOR_TEMPLATE', resource: 'IndicatorTemplate', resourceId: id,
      newValue: { name: template.name, formulaType: template.formulaType, isActive: template.isActive },
    });
    return template;
  }

  async removeTemplate(id: string, userId: string) {
    await this.getTemplate(id);
    const entryCount = await this.prisma.indicatorEntry.count({ where: { templateId: id } });
    if (entryCount > 0) {
      throw new BadRequestException(
        `Cannot delete: this indicator has ${entryCount} recorded value(s). Deactivate it instead to preserve history.`,
      );
    }
    await this.prisma.indicatorTemplate.delete({ where: { id } });
    await this.audit.log({ userId, action: 'DELETE_INDICATOR_TEMPLATE', resource: 'IndicatorTemplate', resourceId: id });
    return { success: true };
  }

  // ─── Entries (Admin data) ────────────────────────────────────────────────────

  async listEntries(filter: { templateId?: string; year?: number; month?: number; framework?: string; departmentCode?: string }) {
    return this.prisma.indicatorEntry.findMany({
      where: {
        ...(filter.templateId ? { templateId: filter.templateId } : {}),
        ...(filter.year ? { year: filter.year } : {}),
        ...(filter.month ? { month: filter.month } : {}),
        ...(filter.framework || filter.departmentCode
          ? {
              template: {
                ...(filter.departmentCode ? { departmentCode: filter.departmentCode } : {}),
                ...(filter.framework ? { type: { framework: filter.framework as any } } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        template: { select: { id: true, name: true, unit: true, formulaType: true, departmentName: true } },
        enteredBy: { select: { id: true, name: true } },
      },
    });
  }

  async templateHistory(templateId: string) {
    await this.getTemplate(templateId);
    return this.prisma.indicatorEntry.findMany({
      where: { templateId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { enteredBy: { select: { id: true, name: true } } },
    });
  }

  /** Create or update the single entry for (template, year, month), recomputing the result. */
  async upsertEntry(dto: UpsertIndicatorEntryDto, userId: string) {
    const template = await this.getTemplate(dto.templateId);

    // Prefer the structured spec when it exists and inputs were supplied; else
    // fall back to the legacy numerator/denominator engine. Both produce the same
    // result (proven by the Phase 0/1 parity harness), so this is behaviour-preserving.
    const spec = template.formulaSpec as unknown as FormulaSpec | null;
    const useSpec = !!spec && (spec.mode === 'list' || !!(dto.inputValues && Object.keys(dto.inputValues).length));
    if (useSpec) {
      const iv = validateInputs(spec as FormulaSpec, dto.inputValues ?? {}, dto.sampleValues ?? []);
      if (!iv.ok) throw new BadRequestException(iv.error);
    }
    const computedResult = useSpec
      ? computeFromSpec(spec as FormulaSpec, dto.inputValues ?? {}, dto.sampleValues ?? [])
      : computeIndicator({
          formulaType: template.formulaType,
          multiplier: template.multiplier,
          numeratorValue: dto.numeratorValue ?? null,
          denominatorValue: dto.denominatorValue ?? null,
          sampleValues: dto.sampleValues ?? null,
          customExpression: template.customExpression,
        });
    if (useSpec && !validateResult(computedResult)) {
      throw new BadRequestException('Result is not computable — check the values (e.g. division by zero).');
    }

    const data = {
      numeratorValue: dto.numeratorValue ?? null,
      denominatorValue: dto.denominatorValue ?? null,
      sampleValues: dto.sampleValues ?? [],
      inputValues: (dto.inputValues ?? undefined) as any,
      note: dto.note ?? null,
      computedResult,
      enteredById: userId,
    };

    const entry = await this.prisma.indicatorEntry.upsert({
      where: { templateId_year_month: { templateId: dto.templateId, year: dto.year, month: dto.month } },
      update: data,
      create: { templateId: dto.templateId, year: dto.year, month: dto.month, ...data },
    });

    await this.audit.log({
      userId, action: 'UPSERT_INDICATOR_ENTRY', resource: 'IndicatorEntry', resourceId: entry.id,
      newValue: { template: template.name, year: dto.year, month: dto.month, result: computedResult },
    });
    return entry;
  }

  /** Save many monthly entries in one call (used by the data-entry "Save all"). */
  async bulkUpsert(entries: UpsertIndicatorEntryDto[], userId: string) {
    const saved: any[] = [];
    for (const dto of entries) saved.push(await this.upsertEntry(dto, userId));
    return { count: saved.length, entries: saved };
  }

  async deleteEntry(id: string, userId: string) {
    const entry = await this.prisma.indicatorEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found');
    await this.prisma.indicatorEntry.delete({ where: { id } });
    await this.audit.log({ userId, action: 'DELETE_INDICATOR_ENTRY', resource: 'IndicatorEntry', resourceId: id });
    return { success: true };
  }

  // ─── Live preview ────────────────────────────────────────────────────────────

  preview(dto: PreviewComputeDto) {
    return {
      computedResult: computeIndicator({
        formulaType: dto.formulaType,
        multiplier: dto.multiplier ?? 1,
        numeratorValue: dto.numeratorValue ?? null,
        denominatorValue: dto.denominatorValue ?? null,
        sampleValues: dto.sampleValues ?? null,
        customExpression: dto.customExpression ?? null,
      }),
    };
  }
}
