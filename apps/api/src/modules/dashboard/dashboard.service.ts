import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Quarter, AssessmentStatus } from '@nabh/shared';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const [
      totalAssessments,
      totalCycles,
      pendingApprovals,
      approvedCount,
      rejectedCount,
      totalUsers,
    ] = await Promise.all([
      this.prisma.assessment.count(),
      this.prisma.institutionAssessment.count(),
      this.prisma.assessment.count({ where: { status: AssessmentStatus.SUBMITTED } }),
      this.prisma.assessment.count({ where: { status: AssessmentStatus.APPROVED } }),
      this.prisma.assessment.count({ where: { status: AssessmentStatus.REJECTED } }),
      this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    ]);

    const avgCompliance = await this.prisma.assessment.aggregate({
      _avg: { compliancePct: true },
      where: { status: AssessmentStatus.APPROVED },
    });

    return {
      totalAssessments,
      totalCycles,
      pendingApprovals,
      approvedCount,
      rejectedCount,
      totalUsers,
      avgCompliancePct: Math.round(avgCompliance._avg.compliancePct || 0),
    };
  }

  async getDepartmentScores(year?: number) {
    const currentYear = year || new Date().getFullYear();
    const assessments = await this.prisma.assessment.findMany({
      where: { status: AssessmentStatus.APPROVED, year: currentYear },
      include: { department: true },
      orderBy: [{ quarter: 'asc' }],
    });

    // Group by department — keep all quarters to compute trend
    const deptMap = new Map<string, { name: string; code: string; scores: number[] }>();
    for (const a of assessments) {
      const entry = deptMap.get(a.departmentId) ?? {
        name: a.department.name,
        code: a.department.code,
        scores: [],
      };
      entry.scores.push(a.compliancePct ?? 0);
      deptMap.set(a.departmentId, entry);
    }

    return Array.from(deptMap.values()).map((d) => {
      const latest = d.scores[d.scores.length - 1] ?? 0;
      const prev = d.scores.length >= 2 ? d.scores[d.scores.length - 2] : latest;
      return {
        department: d.name,
        code: d.code,
        latestPct: Math.round(latest * 10) / 10,
        trend: Math.round((latest - prev) * 10) / 10,
        assessmentCount: d.scores.length,
      };
    }).sort((a, b) => b.latestPct - a.latestPct);
  }

  async getQuarterlyTrends(departmentId?: string) {
    const where: any = { status: AssessmentStatus.APPROVED };
    if (departmentId) where.departmentId = departmentId;

    const assessments = await this.prisma.assessment.findMany({
      where,
      select: { quarter: true, year: true, compliancePct: true },
      orderBy: [{ year: 'asc' }, { quarter: 'asc' }],
    });

    // Aggregate by (year, quarter)
    const trendMap = new Map<string, { quarter: string; year: number; total: number; count: number }>();
    for (const a of assessments) {
      const key = `${a.year}-${a.quarter}`;
      const entry = trendMap.get(key) ?? { quarter: a.quarter, year: a.year, total: 0, count: 0 };
      entry.total += a.compliancePct ?? 0;
      entry.count += 1;
      trendMap.set(key, entry);
    }

    return Array.from(trendMap.values()).map((e) => ({
      quarter: e.quarter,
      year: e.year,
      avgCompliance: Math.round((e.total / e.count) * 10) / 10,
      totalAssessments: e.count,
    }));
  }

  async getAreaWiseBreakdown(year?: number) {
    const currentYear = year || new Date().getFullYear();

    const assessments = await this.prisma.assessment.findMany({
      where: { status: AssessmentStatus.APPROVED, year: currentYear },
      include: {
        responses: {
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
    });

    const areaScores: Record<string, { obtained: number; max: number; name: string }> = {};

    for (const assessment of assessments) {
      for (const response of assessment.responses) {
        if (response.isNa) continue;
        const area = response.clientCheckpoint?.mapping?.measurableElement?.standard?.areaOfConcern;
        if (!area) continue;

        if (!areaScores[area.code]) {
          areaScores[area.code] = { obtained: 0, max: 0, name: area.name };
        }
        areaScores[area.code].obtained += response.nqasScore;
        areaScores[area.code].max += response.clientCheckpoint?.mapping?.measurableElement?.maxScore || 0;
      }
    }

    return Object.entries(areaScores).map(([code, val]) => ({
      areaCode: code,
      areaName: val.name,
      obtained: val.obtained,
      max: val.max,
      pct: val.max > 0 ? Math.round((val.obtained / val.max) * 100) : 0,
    }));
  }
}
