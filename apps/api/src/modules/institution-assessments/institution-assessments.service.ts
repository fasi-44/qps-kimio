import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInstitutionAssessmentDto } from './dto/institution-assessment.dto';
import { AppModule } from '@nabh/shared';

@Injectable()
export class InstitutionAssessmentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInstitutionAssessmentDto, userId: string) {
    const module = dto.module ?? AppModule.NQAS;
    return this.prisma.institutionAssessment.create({
      data: {
        name: dto.name,
        quarter: dto.quarter,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        assessmentDate: new Date(dto.assessmentDate),
        type: dto.type,
        module,
        assessorNames: dto.assessorNames ?? [],
        notes: dto.notes ?? null,
        createdById: userId,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async findAll(filters: { module?: string; year?: number } = {}) {
    const where: any = {};
    if (filters.module) where.module = filters.module;
    if (filters.year) where.year = +filters.year;
    return this.prisma.institutionAssessment.findMany({
      where,
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { assessments: true } },
      },
    });
  }

  async findOne(id: string) {
    const ia = await this.prisma.institutionAssessment.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        assessments: {
          include: {
            department: true,
            assessor: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ia) throw new NotFoundException('Institution assessment not found');

    const clientDepts = await this.prisma.clientDepartment.findMany({
      where: { module: ia.module, isActive: true },
      orderBy: { order: 'asc' },
    });

    const assessmentByNqasDeptId = new Map(
      ia.assessments.map((a) => [a.departmentId, a]),
    );

    const departments = clientDepts.map((cd) => {
      const assessment = cd.nqasDepartmentId
        ? assessmentByNqasDeptId.get(cd.nqasDepartmentId)
        : undefined;
      return {
        clientDepartmentId: cd.id,
        departmentCode: cd.code,
        departmentName: cd.name,
        programmes: cd.programmes,
        nqasDepartmentId: cd.nqasDepartmentId,
        assessment: assessment
          ? {
              id: assessment.id,
              status: assessment.status,
              compliancePct: assessment.compliancePct,
              totalNqasScore: assessment.totalNqasScore,
              maxNqasScore: assessment.maxNqasScore,
              completedSections: assessment.completedSections,
              assessor: (assessment as any).assessor,
            }
          : null,
      };
    });

    const completed = departments.filter((d) => d.assessment?.status === 'APPROVED').length;
    const inProgress = departments.filter(
      (d) => d.assessment && d.assessment.status !== 'APPROVED',
    ).length;

    return {
      ...ia,
      departments,
      stats: {
        total: departments.length,
        completed,
        inProgress,
        notStarted: departments.length - completed - inProgress,
      },
    };
  }

  /** Department Wise compliance report with LaQshya/MusQan programme scores */
  async getReport(id: string) {
    const ia = await this.prisma.institutionAssessment.findUnique({
      where: { id },
      include: {
        assessments: {
          where: { status: { in: ['SUBMITTED', 'APPROVED', 'IN_PROGRESS'] } },
          include: {
            department: {
              include: {
                areasOfConcern: {
                  orderBy: { order: 'asc' },
                  include: {
                    standards: {
                      orderBy: { order: 'asc' },
                      include: { measurableElements: { where: { isScored: true } } },
                    },
                  },
                },
              },
            },
            responses: {
              where: { isNa: false },
              include: {
                clientCheckpoint: {
                  include: {
                    mapping: {
                      include: {
                        measurableElement: {
                          include: { standard: { include: { areaOfConcern: true } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!ia) throw new NotFoundException('Institution assessment not found');

    // Fetch client department programmes so we can classify LaQshya/MusQan
    const clientDepts = await this.prisma.clientDepartment.findMany({
      where: { isActive: true },
      select: { nqasDepartmentId: true, code: true, programmes: true },
    });
    // nqasDeptId → programmes[]
    const deptProgrammes = new Map<string, string[]>(
      clientDepts
        .filter((cd) => cd.nqasDepartmentId)
        .map((cd) => [cd.nqasDepartmentId!, cd.programmes]),
    );

    const deptReports = ia.assessments.map((assessment) => {
      // Build area max-scores from the NQAS ME structure (single source of truth)
      const areaMeta: Record<string, { name: string; order: number; max: number }> = {};
      for (const aoc of assessment.department.areasOfConcern) {
        const max = aoc.standards.reduce(
          (s, std) => s + std.measurableElements.reduce((s2, me) => s2 + me.maxScore, 0),
          0,
        );
        areaMeta[aoc.code] = { name: aoc.name, order: aoc.order, max };
      }

      // Tally obtained scores from actual responses
      const areaObtained: Record<string, number> = {};
      for (const resp of assessment.responses) {
        const area = resp.clientCheckpoint?.mapping?.measurableElement?.standard?.areaOfConcern;
        if (!area) continue;
        areaObtained[area.code] = (areaObtained[area.code] ?? 0) + resp.nqasScore;
      }

      // Also build standard-level data for the standards table
      const standardMeta: Record<string, { name: string; order: number; areaCode: string; areaName: string; areaOrder: number }> = {};
      for (const aoc of assessment.department.areasOfConcern) {
        for (const std of aoc.standards) {
          standardMeta[std.code] = { name: std.name, order: std.order, areaCode: aoc.code, areaName: aoc.name, areaOrder: aoc.order };
        }
      }

      // Tally standard-level obtained scores from responses
      const standardObtained: Record<string, number> = {};
      const standardMax: Record<string, number> = {};
      for (const aoc of assessment.department.areasOfConcern) {
        for (const std of aoc.standards) {
          const max = std.measurableElements.reduce((s, me) => s + me.maxScore, 0);
          standardMax[std.code] = (standardMax[std.code] ?? 0) + max;
        }
      }
      for (const resp of assessment.responses) {
        const std = resp.clientCheckpoint?.mapping?.measurableElement?.standard;
        if (!std) continue;
        standardObtained[std.code] = (standardObtained[std.code] ?? 0) + resp.nqasScore;
      }

      const programmes = deptProgrammes.get(assessment.departmentId) ?? ['NQAS'];

      return {
        departmentId: assessment.departmentId,
        departmentCode: assessment.department.code,
        departmentName: assessment.department.name,
        assessmentId: assessment.id,
        status: assessment.status,
        compliancePct: assessment.compliancePct,
        totalNqasScore: assessment.totalNqasScore,
        maxNqasScore: assessment.maxNqasScore,
        programmes,
        areas: Object.entries(areaMeta)
          .map(([code, meta]) => ({
            code,
            name: meta.name,
            order: meta.order,
            obtained: areaObtained[code] ?? 0,
            max: meta.max,
            pct: meta.max > 0 ? Math.round(((areaObtained[code] ?? 0) / meta.max) * 100) : 0,
          }))
          .sort((a, b) => a.order - b.order),
        standards: Object.entries(standardMeta).map(([code, meta]) => ({
          code,
          name: meta.name,
          order: meta.order,
          areaCode: meta.areaCode,
          areaName: meta.areaName,
          areaOrder: meta.areaOrder,
          obtained: standardObtained[code] ?? 0,
          max: standardMax[code] ?? 0,
          pct: (standardMax[code] ?? 0) > 0 ? Math.round(((standardObtained[code] ?? 0) / standardMax[code]) * 100) : 0,
        })).sort((a, b) => a.areaOrder - b.areaOrder || a.order - b.order),
      };
    });

    // Collect all unique areas across all departments
    const allAreas = new Map<string, { code: string; name: string; order: number }>();
    for (const dr of deptReports) {
      for (const a of dr.areas) {
        if (!allAreas.has(a.code)) allAreas.set(a.code, { code: a.code, name: a.name, order: a.order });
      }
    }
    const areas = Array.from(allAreas.values()).sort((a, b) => a.order - b.order);

    // Programme scores (Hospital / LaQshya / MusQan)
    const programmeScores = this.calcProgrammeScores(deptReports);

    // Build standards table: each standard with per-programme scores
    const allStandardsMeta = new Map<string, { name: string; areaCode: string; areaName: string; areaOrder: number; order: number }>();
    for (const dr of deptReports) {
      for (const std of (dr as any).standards ?? []) {
        if (!allStandardsMeta.has(std.code)) {
          allStandardsMeta.set(std.code, { name: std.name, areaCode: std.areaCode, areaName: std.areaName, areaOrder: std.areaOrder, order: std.order });
        }
      }
    }

    const PROGS = ['NQAS', 'LAQSHYA', 'MUSQAN'] as const;
    const standardsTable = Array.from(allStandardsMeta.entries()).map(([code, meta]) => {
      const progScores: Record<string, { obtained: number; max: number; pct: number } | null> = {};
      for (const prog of PROGS) {
        let ob = 0; let mx = 0;
        for (const dr of deptReports) {
          if (!((dr.programmes ?? ['NQAS']).includes(prog))) continue;
          const stdScore = ((dr as any).standards ?? []).find((s: any) => s.code === code);
          if (!stdScore) continue;
          ob += stdScore.obtained;
          mx += stdScore.max;
        }
        progScores[prog] = mx > 0 ? { obtained: ob, max: mx, pct: Math.round((ob / mx) * 100) } : null;
      }
      return { code, name: meta.name, areaCode: meta.areaCode, areaName: meta.areaName, nqas: progScores.NQAS, laqshya: progScores.LAQSHYA, musqan: progScores.MUSQAN };
    }).sort((a, b) => {
      const am = allStandardsMeta.get(a.code)!;
      const bm = allStandardsMeta.get(b.code)!;
      return am.areaOrder - bm.areaOrder || am.order - bm.order;
    });

    return {
      institutionAssessment: {
        id: ia.id,
        name: ia.name,
        quarter: ia.quarter,
        year: ia.year,
        type: ia.type,
        module: ia.module,
        assessmentDate: ia.assessmentDate,
        startDate: ia.startDate,
        endDate: ia.endDate,
      },
      departments: deptReports,
      areas,
      programmeScores,
      standardsTable,
    };
  }

  private calcProgrammeScores(deptReports: any[]) {
    const programmes = ['NQAS', 'LAQSHYA', 'MUSQAN'];
    const result: Record<string, { obtained: number; max: number; pct: number; deptCount: number }> = {};

    for (const prog of programmes) {
      const depts = deptReports.filter((d) => (d.programmes ?? ['NQAS']).includes(prog));
      const obtained = depts.reduce((s, d) => s + d.totalNqasScore, 0);
      const max = depts.reduce((s, d) => s + d.maxNqasScore, 0);
      result[prog] = {
        obtained,
        max,
        pct: max > 0 ? Math.round((obtained / max) * 100) : 0,
        deptCount: depts.length,
      };
    }
    return result;
  }

  /** Compare multiple institution assessments side by side */
  async compare(ids: string[]) {
    const reports = await Promise.all(ids.map((id) => this.getReport(id)));
    return reports;
  }
}
