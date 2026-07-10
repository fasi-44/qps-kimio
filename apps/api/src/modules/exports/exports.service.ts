import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoresService } from '../scores/scores.service';

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private scores: ScoresService,
  ) {}

  async exportAssessmentExcel(assessmentId: string): Promise<Buffer> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        department: true,
        assessor: { select: { name: true } },
        responses: {
          include: {
            clientCheckpoint: {
              include: {
                clientSection: true,
                mapping: {
                  include: {
                    measurableElement: {
                      include: {
                        standard: { include: { areaOfConcern: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { sectionCode: 'asc' },
        },
      },
    });

    if (!assessment) throw new NotFoundException('Assessment not found');

    const breakdown = await this.scores.getAssessmentScoreBreakdown(assessmentId);
    const wb = new ExcelJS.Workbook();

    // ─── Summary sheet ────────────────────────────────────────────────────────
    const summary = wb.addWorksheet('Summary');
    summary.mergeCells('A1:F1');
    const titleCell = summary.getCell('A1');
    titleCell.value = 'NQAS Assessment Score Card';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' } };
    titleCell.alignment = { horizontal: 'center' };

    summary.getRow(3).values = ['Department', assessment.department.name];
    summary.getRow(4).values = ['Quarter / Year', `${assessment.quarter} ${assessment.year}`];
    summary.getRow(5).values = ['Assessor', assessment.assessor?.name || '-'];
    summary.getRow(6).values = ['Assessee', assessment.assesseeName];
    summary.getRow(7).values = ['Type', assessment.type];
    summary.getRow(8).values = ['Status', assessment.status];
    summary.getRow(9).values = ['Overall Compliance', `${Math.round(assessment.compliancePct)}%`];

    summary.getRow(11).values = ['Area', 'Score Obtained', 'Max Score', 'Compliance %', 'Status'];
    const headerRow = summary.getRow(11);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };

    let row = 12;
    for (const area of (breakdown?.areas || [])) {
      const aRow = summary.getRow(row++);
      const statusLabel = area.pct >= 80 ? 'Excellent' : area.pct >= 70 ? 'Satisfactory' : 'Needs Improvement';
      aRow.values = [
        `${area.areaCode}. ${area.areaName}`,
        area.obtained,
        area.max,
        `${area.pct}%`,
        statusLabel,
      ];
    }

    // ─── Responses sheet ──────────────────────────────────────────────────────
    const responses = wb.addWorksheet('Checklist Responses');
    responses.getRow(1).values = [
      '#', 'Section', 'Checkpoint Code', 'Checkpoint Description',
      'Client Score', 'Max Score', 'NQAS ME Ref', 'NQAS Score', 'District Max', 'N/A', 'Remarks',
    ];
    const rHeader = responses.getRow(1);
    rHeader.font = { bold: true };
    rHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    let rRow = 2;
    for (const r of assessment.responses) {
      responses.getRow(rRow++).values = [
        rRow - 2,
        r.clientCheckpoint?.clientSection?.sectionName || '-',
        r.clientCheckpoint?.checkpointCode || '-',
        r.clientCheckpoint?.description || '-',
        r.clientScore,
        r.clientCheckpoint?.maxScore || 0,
        r.clientCheckpoint?.mapping?.measurableElement?.meRef || 'N/A',
        r.nqasScore,
        r.clientCheckpoint?.mapping?.measurableElement?.maxScore || 0,
        r.isNa ? 'Yes' : 'No',
        r.remarks || '',
      ];
    }

    // Auto-fit columns
    [summary, responses].forEach((ws) => {
      ws.columns.forEach((col) => {
        col.width = 20;
      });
    });

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
