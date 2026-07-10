import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoresService } from '../scores/scores.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateAssessmentDto, SaveSectionResponsesDto, UpdateAssessmentNotesDto,
} from './dto/assessment.dto';
import { AssessmentStatus, UserRole, ScoreMappingType, AppModule } from '@nabh/shared';

@Injectable()
export class AssessmentsService {
  constructor(
    private prisma: PrismaService,
    private scores: ScoresService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateAssessmentDto, userId: string) {
    const module = dto.module ?? AppModule.NQAS;
    // Check no duplicate for same dept+quarter+year+type+module
    const existing = await this.prisma.assessment.findUnique({
      where: {
        departmentId_quarter_year_type_module: {
          departmentId: dto.departmentId,
          quarter: dto.quarter,
          year: dto.year,
          type: dto.type,
          module,
        },
      },
    });
    if (existing && existing.status !== AssessmentStatus.REJECTED) {
      throw new BadRequestException(
        `An assessment already exists for this department/quarter/year (status: ${existing.status})`,
      );
    }

    const assessment = await this.prisma.assessment.create({
      data: {
        quarter: dto.quarter,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        assessmentDate: new Date(dto.assessmentDate),
        type: dto.type,
        module,
        departmentId: dto.departmentId,
        assesseeName: dto.assesseeName,
        assessorNames: dto.assessorNames,
        notes: dto.notes ?? null,
        assessorId: userId,
        status: AssessmentStatus.DRAFT,
        institutionAssessmentId: dto.institutionAssessmentId ?? null,
      },
      include: { department: true, assessor: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.log({
      userId,
      action: 'CREATE_ASSESSMENT',
      resource: 'Assessment',
      resourceId: assessment.id,
      newValue: { departmentId: dto.departmentId, quarter: dto.quarter, year: dto.year },
    });

    return assessment;
  }

  async findAll(userId: string, userRole: UserRole, page = 1, limit = 20, filters: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // Assessors see all assessments (read-only for others, edit-only for own)

    if (filters.status) where.status = filters.status;
    if (filters.quarter) where.quarter = filters.quarter;
    if (filters.year) where.year = +filters.year;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.module) where.module = filters.module;
    if (filters.institutionAssessmentId) where.institutionAssessmentId = filters.institutionAssessmentId;

    const [data, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: {
            include: {
              clientDepartments: { select: { _count: { select: { sections: true } } } },
            },
          },
          assessor: { select: { id: true, name: true, email: true } },
          _count: { select: { responses: true } },
        },
      }),
      this.prisma.assessment.count({ where }),
    ]);

    const enriched = data.map((a) => {
      const totalSections = (a.department as any).clientDepartments?.[0]?._count?.sections ?? 0;
      const { clientDepartments: _cd, ...dept } = (a.department as any);
      return { ...a, department: dept, totalSections };
    });

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        department: {
          include: {
            areasOfConcern: { orderBy: { order: 'asc' } },
          },
        },
        assessor: { select: { id: true, name: true, email: true, role: true } },
        reviews: {
          include: { reviewer: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!assessment) throw new NotFoundException('Assessment not found');

    // Enrich with client section scores
    const clientDept = await this.findClientDept(assessment.departmentId, assessment.department?.code, {
      sections: {
        orderBy: { sectionOrder: 'asc' },
        include: { _count: { select: { checkpoints: true } } },
      },
    });

    const completedSet = new Set((assessment.completedSections as string[]) ?? []);
    const sections = await Promise.all(
      (clientDept?.sections ?? []).map(async (s: any) => {
        const agg = await this.prisma.assessmentResponse.aggregate({
          where: { assessmentId: id, sectionCode: s.sectionCode, isNa: false },
          _sum: { clientScore: true, nqasScore: true },
          _count: { id: true },
        });
        const maxAgg = await this.prisma.clientCheckpoint.aggregate({
          where: { clientSectionId: s.id },
          _sum: { maxScore: true },
        });
        const score = agg._sum?.nqasScore ?? 0;
        const maxScore = maxAgg._sum?.maxScore ?? 0;
        return {
          sectionCode: s.sectionCode,
          sectionName: s.sectionName,
          sectionOrder: s.sectionOrder,
          checkpointCount: s._count.checkpoints,
          completed: completedSet.has(s.sectionCode),
          score,
          maxScore,
          pct: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
        };
      }),
    );

    return { ...assessment, sections, latestReview: assessment.reviews?.[0] ?? null };
  }

  async startAssessment(id: string, userId: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.assessorId !== userId) throw new ForbiddenException('Not your assessment');

    const allowedStatuses = [AssessmentStatus.DRAFT, AssessmentStatus.SENT_BACK];
    if (!allowedStatuses.includes(assessment.status as AssessmentStatus)) {
      throw new BadRequestException(`Cannot start assessment in status: ${assessment.status}`);
    }

    const updated = await this.prisma.assessment.update({
      where: { id },
      data: { status: AssessmentStatus.IN_PROGRESS },
    });

    await this.audit.log({
      userId,
      action: 'START_ASSESSMENT',
      resource: 'Assessment',
      resourceId: id,
    });

    return updated;
  }

  async saveSectionResponses(
    assessmentId: string,
    dto: SaveSectionResponsesDto,
    userId: string,
  ) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.assessorId !== userId) throw new ForbiddenException('Not your assessment');
    if (
      assessment.status !== AssessmentStatus.IN_PROGRESS &&
      assessment.status !== AssessmentStatus.SENT_BACK
    ) {
      throw new BadRequestException('Assessment is not in progress');
    }

    // Get mappings for score calculation
    const checkpointIds = dto.responses.map((r) => r.clientCheckpointId);
    const mappings = await this.prisma.checklistMapping.findMany({
      where: { clientCheckpointId: { in: checkpointIds } },
      include: {
        measurableElement: true,
        clientCheckpoint: true,
      },
    });

    const mappingMap = new Map(mappings.map((m) => [m.clientCheckpointId, m]));

    // Upsert each response
    for (const resp of dto.responses) {
      const mapping = mappingMap.get(resp.clientCheckpointId);
      const isNa = !mapping || mapping.isNa || !mapping.measurableElementId;

      let nqasScore = 0;
      if (!isNa && mapping) {
        nqasScore = this.scores.calculateNqasScore(
          resp.clientScore,
          mapping.clientCheckpoint.maxScore,
          mapping.scoreMappingType as ScoreMappingType,
          mapping.measurableElement?.maxScore || 0,
          mapping.scoreMappingFormula,
        );
      }

      await this.prisma.assessmentResponse.upsert({
        where: {
          assessmentId_clientCheckpointId: {
            assessmentId,
            clientCheckpointId: resp.clientCheckpointId,
          },
        },
        update: {
          clientScore: resp.clientScore,
          nqasScore,
          isNa,
          remarks: resp.remarks || null,
          usedMethod: resp.usedMethod || null,
          mappingSnapshotType: mapping?.scoreMappingType as any || null,
          mappingSnapshotFormula: mapping?.scoreMappingFormula as any || null,
          sectionCode: dto.sectionCode,
        },
        create: {
          assessmentId,
          module: assessment.module,
          clientCheckpointId: resp.clientCheckpointId,
          clientScore: resp.clientScore,
          nqasScore,
          isNa,
          remarks: resp.remarks || null,
          usedMethod: resp.usedMethod || null,
          mappingSnapshotType: mapping?.scoreMappingType as any || null,
          mappingSnapshotFormula: mapping?.scoreMappingFormula as any || null,
          sectionCode: dto.sectionCode,
        },
      });
    }

    // Mark section as completed
    const completedSections = new Set([
      ...(assessment.completedSections || []),
      dto.sectionCode,
    ]);

    const updated = await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { completedSections: Array.from(completedSections) },
    });

    // Recalculate totals in background
    await this.scores.recalculateAssessmentScores(assessmentId);

    return { message: 'Section saved', completedSections: updated.completedSections };
  }

  async getSectionResponses(assessmentId: string, sectionCode: string, userId: string, userRole: UserRole) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Assessment not found');

    return this.prisma.assessmentResponse.findMany({
      where: { assessmentId, sectionCode },
      include: {
        clientCheckpoint: {
          include: { mapping: { include: { measurableElement: true } } },
        },
      },
    });
  }

  async submit(id: string, userId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { department: true, assessor: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.assessorId !== userId) throw new ForbiddenException('Not your assessment');
    if (
      assessment.status !== AssessmentStatus.IN_PROGRESS &&
      assessment.status !== AssessmentStatus.SENT_BACK
    ) {
      throw new BadRequestException('Assessment must be IN_PROGRESS or SENT_BACK to submit');
    }

    const updated = await this.prisma.assessment.update({
      where: { id },
      data: { status: AssessmentStatus.SUBMITTED, submittedAt: new Date() },
    });

    await this.audit.log({
      userId,
      action: 'SUBMIT_ASSESSMENT',
      resource: 'Assessment',
      resourceId: id,
    });

    return updated;
  }

  async updateNotes(id: string, dto: UpdateAssessmentNotesDto, userId: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.assessorId !== userId) throw new ForbiddenException('Not your assessment');

    const updated = await this.prisma.assessment.update({ where: { id }, data: dto });

    await this.audit.log({
      userId,
      action: 'UPDATE_ASSESSMENT',
      resource: 'Assessment',
      resourceId: id,
      newValue: dto as Record<string, any>,
    });

    return updated;
  }

  /** Returns assessment + client sections with per-section completion status for the wizard */
  async getWizardInfo(id: string, userId: string, userRole: UserRole) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        department: {
          include: {
            clientDepartments: {
              include: {
                sections: {
                  orderBy: { sectionOrder: 'asc' },
                  include: { _count: { select: { checkpoints: true } } },
                },
              },
            },
          },
        },
        assessor: { select: { id: true, name: true, email: true } },
        institutionAssessment: { select: { id: true, name: true, quarter: true, year: true, type: true } },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const completedSet = new Set((assessment.completedSections as string[]) ?? []);
    const clientDept = assessment.department?.clientDepartments?.[0]
      ?? await this.findClientDept(assessment.departmentId, assessment.department?.code, {
          sections: {
            orderBy: { sectionOrder: 'asc' },
            include: { _count: { select: { checkpoints: true } } },
          },
        });

    const sections = (clientDept?.sections ?? []).map((s: any) => ({
      sectionCode: s.sectionCode,
      sectionName: s.sectionName,
      sectionOrder: s.sectionOrder,
      checkpointCount: s._count.checkpoints,
      completed: completedSet.has(s.sectionCode),
    }));

    return {
      ...assessment,
      sections,
      clientDepartmentId: clientDept?.id ?? null,
    };
  }

  /** Returns checkpoints with their NQAS mapping info for a wizard section */
  async getSectionCheckpoints(
    assessmentId: string,
    sectionCode: string,
    userId: string,
    userRole: UserRole,
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { department: { select: { code: true } } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const clientDept = await this.findClientDept(assessment.departmentId, (assessment as any).department?.code);
    if (!clientDept) return [];

    const section = await this.prisma.clientSection.findFirst({
      where: { clientDepartmentId: clientDept.id, sectionCode: sectionCode },
    });
    if (!section) throw new NotFoundException(`Section ${sectionCode} not found`);

    const checkpoints = await this.prisma.clientCheckpoint.findMany({
      where: { clientSectionId: section.id },
      orderBy: { checkpointOrder: 'asc' },
      include: {
        mapping: {
          include: {
            measurableElement: {
              select: {
                meRef: true, checkpoint: true, maxScore: true, assessmentMethod: true,
                meansOfVerification: true,
                standard: { select: { code: true, name: true, order: true } },
              },
            },
          },
        },
      },
    });

    return checkpoints.map((cp) => ({
      id: cp.id,
      checkpointCode: cp.checkpointCode,
      description: cp.description,
      evidenceRequired: cp.evidenceRequired,
      maxScore: cp.maxScore,
      sectionCode: section.sectionCode,
      mapping: cp.mapping
        ? {
            meRef: cp.mapping.measurableElement?.meRef ?? '',
            checkpoint: cp.mapping.measurableElement?.checkpoint ?? '',
            maxScore: cp.mapping.measurableElement?.maxScore ?? 0,
            assessmentMethod: cp.mapping.measurableElement?.assessmentMethod ?? '',
            meansOfVerification: cp.mapping.measurableElement?.meansOfVerification ?? null,
            mappingType: cp.mapping.scoreMappingType,
            standardCode: cp.mapping.measurableElement?.standard?.code ?? '',
            standardName: cp.mapping.measurableElement?.standard?.name ?? '',
            standardOrder: cp.mapping.measurableElement?.standard?.order ?? 0,
          }
        : null,
    }));
  }

  /**
   * DEV UTILITY — create an assessment for every active department in a cycle,
   * fill all checkpoints with random scores (0/1/2), and set status to SUBMITTED.
   * Skips departments that already have an active assessment for this cycle.
   * Callable via: POST /assessments/seed-demo?cycleId=<id>   (Admin only)
   */
  async seedDemoAssessments(cycleId: string, userId: string) {
    const cycle = await this.prisma.institutionAssessment.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException(`Institution assessment ${cycleId} not found`);

    // Resolve assessor: use provided userId if valid, otherwise fall back to first admin/assessor
    let resolvedUserId = userId;
    if (userId) {
      const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) resolvedUserId = '';
    }
    if (!resolvedUserId) {
      const fallback = await this.prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!fallback) throw new NotFoundException('No users found in database — run db:seed first');
      resolvedUserId = fallback.id;
    }

    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    const created: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    for (const dept of departments) {
      try {
        // Skip if a non-rejected assessment already exists for this cycle
        const existing = await this.prisma.assessment.findFirst({
          where: {
            departmentId: dept.id,
            institutionAssessmentId: cycleId,
            status: { not: AssessmentStatus.REJECTED },
          },
        });
        if (existing) { skipped.push(`${dept.code} (already exists: ${existing.status})`); continue; }

        // Find client department to get sections/checkpoints
        const clientDept = await this.findClientDept(dept.id, dept.code, {
          sections: {
            orderBy: { sectionOrder: 'asc' },
            include: {
              checkpoints: {
                orderBy: { checkpointOrder: 'asc' },
                include: {
                  mapping: { include: { measurableElement: true, clientCheckpoint: true } },
                },
              },
            },
          },
        });
        if (!clientDept || !clientDept.sections?.length) {
          skipped.push(`${dept.code} (no client dept or sections)`);
          continue;
        }

        // Create assessment already IN_PROGRESS to skip status transitions
        const assessment = await this.prisma.assessment.create({
          data: {
            quarter: cycle.quarter,
            year: cycle.year,
            startDate: cycle.startDate,
            endDate: cycle.endDate,
            assessmentDate: cycle.assessmentDate,
            type: cycle.type,
            module: cycle.module,
            departmentId: dept.id,
            assesseeName: 'Demo Assessee',
            assessorNames: ['Demo Assessor'],
            assessorId: resolvedUserId,
            status: AssessmentStatus.IN_PROGRESS,
            institutionAssessmentId: cycleId,
          },
        });

        // Save random responses for every checkpoint in every section
        const completedSections: string[] = [];
        const METHODS = ['SI', 'OB', 'RR', 'PI'];

        for (const section of clientDept.sections as any[]) {
          for (const cp of section.checkpoints) {
            const clientScore = Math.floor(Math.random() * 3); // 0, 1, or 2
            const mapping = (cp as any).mapping;
            const isNa = !mapping || mapping.isNa || !mapping.measurableElementId;
            const nqasScore = isNa ? 0 : this.scores.calculateNqasScore(
              clientScore,
              cp.maxScore,
              mapping.scoreMappingType as ScoreMappingType,
              mapping.measurableElement?.maxScore || 0,
              mapping.scoreMappingFormula,
            );
            const usedMethod = METHODS[Math.floor(Math.random() * METHODS.length)];

            await this.prisma.assessmentResponse.upsert({
              where: {
                assessmentId_clientCheckpointId: {
                  assessmentId: assessment.id,
                  clientCheckpointId: cp.id,
                },
              },
              update: { clientScore, nqasScore, isNa, sectionCode: section.sectionCode, usedMethod },
              create: {
                assessmentId: assessment.id,
                module: cycle.module as AppModule,
                clientCheckpointId: cp.id,
                clientScore,
                nqasScore,
                isNa,
                sectionCode: section.sectionCode,
                usedMethod,
                mappingSnapshotType: mapping?.scoreMappingType as any || null,
                mappingSnapshotFormula: mapping?.scoreMappingFormula as any || null,
              },
            });
          }
          completedSections.push(section.sectionCode);
        }

        // Recalculate totals and submit
        await this.scores.recalculateAssessmentScores(assessment.id);
        await this.prisma.assessment.update({
          where: { id: assessment.id },
          data: {
            completedSections,
            status: AssessmentStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        });

        created.push(dept.code);
      } catch (err: any) {
        failed.push(`${dept.code}: ${err?.message ?? 'unknown error'}`);
      }
    }

    return {
      cycleId,
      cycleName: cycle.name,
      assessorId: resolvedUserId,
      created: created.length,
      skipped: skipped.length,
      failed: failed.length,
      details: { created, skipped, failed },
    };
  }

  /** Finds ClientDepartment by nqasDepartmentId first, then falls back to code match */
  private async findClientDept(departmentId: string, departmentCode?: string, include?: any) {
    const byLink = await this.prisma.clientDepartment.findFirst({
      where: { nqasDepartmentId: departmentId },
      include,
    });
    if (byLink) return byLink;
    if (!departmentCode) return null;
    return this.prisma.clientDepartment.findFirst({
      where: { code: { equals: departmentCode, mode: 'insensitive' } },
      include,
    });
  }
}
