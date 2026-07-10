import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoreMappingType } from '@nabh/shared';

@Injectable()
export class ScoresService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate NQAS district score from a client score using the stored mapping.
   */
  calculateNqasScore(
    clientScore: number,
    clientMaxScore: number,
    mappingType: ScoreMappingType,
    districtMaxScore: number,
    formula: any,
  ): number {
    if (mappingType === ScoreMappingType.NOT_APPLICABLE) return 0;

    switch (mappingType) {
      case ScoreMappingType.DIRECT:
        return Math.min(clientScore, districtMaxScore);

      case ScoreMappingType.PROPORTIONAL: {
        if (clientMaxScore === 0) return 0;
        return Math.round((clientScore / clientMaxScore) * districtMaxScore);
      }

      case ScoreMappingType.CONDITIONAL: {
        if (!formula?.lookup || !Array.isArray(formula.lookup)) return clientScore;
        const match = formula.lookup.find((l: any) => l.clientScore === clientScore);
        return match ? match.districtScore : 0;
      }

      default:
        return clientScore;
    }
  }

  async getAssessmentScoreBreakdown(assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        department: {
          include: {
            areasOfConcern: {
              orderBy: { order: 'asc' },
              include: {
                standards: {
                  orderBy: { order: 'asc' },
                  include: {
                    measurableElements: {
                      where: { isScored: true },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          include: {
            clientCheckpoint: {
              include: {
                mapping: true,
              },
            },
          },
        },
      },
    });

    if (!assessment) return null;

    const areaScores = assessment.department.areasOfConcern.map((area) => {
      let areaObtained = 0;
      let areaMax = 0;

      const standardScores = area.standards.map((standard) => {
        let stdObtained = 0;
        let stdMax = 0;

        for (const me of standard.measurableElements) {
          // Find responses mapped to this ME
          const mappedResponses = assessment.responses.filter(
            (r) => r.clientCheckpoint?.mapping?.measurableElementId === me.id && !r.isNa,
          );

          const obtained = mappedResponses.reduce((sum, r) => sum + r.nqasScore, 0);
          stdObtained += obtained;
          stdMax += me.maxScore;
        }

        areaObtained += stdObtained;
        areaMax += stdMax;

        return {
          code: standard.code,
          name: standard.name,
          obtained: stdObtained,
          max: stdMax,
          pct: stdMax > 0 ? Math.round((stdObtained / stdMax) * 100) : 0,
        };
      });

      return {
        areaCode: area.code,
        areaName: area.name,
        obtained: areaObtained,
        max: areaMax,
        pct: areaMax > 0 ? Math.round((areaObtained / areaMax) * 100) : 0,
        standards: standardScores,
      };
    });

    const totalObtained = areaScores.reduce((s, a) => s + a.obtained, 0);
    const totalMax = areaScores.reduce((s, a) => s + a.max, 0);
    const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

    return {
      assessmentId,
      department: { id: assessment.departmentId, name: assessment.department.name },
      quarter: assessment.quarter,
      year: assessment.year,
      areas: areaScores,
      totalObtained,
      totalMax,
      overallPct,
      complianceStatus:
        overallPct >= 80 ? 'excellent'
        : overallPct >= 70 ? 'satisfactory'
        : overallPct >= 50 ? 'partial'
        : 'non_compliant',
    };
  }

  async recalculateAssessmentScores(assessmentId: string) {
    const responses = await this.prisma.assessmentResponse.findMany({
      where: { assessmentId },
      include: {
        clientCheckpoint: { include: { mapping: { include: { measurableElement: true } } } },
      },
    });

    let totalClientScore = 0;
    let totalNqasScore = 0;
    let maxClientScore = 0;
    let maxNqasScore = 0;

    for (const response of responses) {
      if (response.isNa) continue;
      const mapping = response.clientCheckpoint?.mapping;
      if (!mapping || mapping.isNa) continue;

      const districtMax = mapping.measurableElement?.maxScore || 0;
      const nqasScore = this.calculateNqasScore(
        response.clientScore,
        response.clientCheckpoint.maxScore,
        mapping.scoreMappingType as ScoreMappingType,
        districtMax,
        mapping.scoreMappingFormula,
      );

      // Update response NQAS score
      await this.prisma.assessmentResponse.update({
        where: { id: response.id },
        data: { nqasScore },
      });

      totalClientScore += response.clientScore;
      totalNqasScore += nqasScore;
      maxClientScore += response.clientCheckpoint.maxScore;
      maxNqasScore += districtMax;
    }

    const compliancePct = maxNqasScore > 0
      ? Math.round((totalNqasScore / maxNqasScore) * 100)
      : 0;

    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { totalClientScore, totalNqasScore, maxClientScore, maxNqasScore, compliancePct },
    });

    return { totalClientScore, totalNqasScore, maxClientScore, maxNqasScore, compliancePct };
  }
}
