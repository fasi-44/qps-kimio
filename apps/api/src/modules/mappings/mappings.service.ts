import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ScoreMappingType } from '@nabh/shared';

interface MappingEntry {
  clientDepartment: string;
  clientSectionName: string;
  clientCheckpointCode: string;
  clientCheckpointDescription: string;
  clientMaxScore: number;
  districtDepartment?: string;
  districtMERef?: string;
  districtMEDescription?: string;
  districtMaxScore?: number;
  scoreMapping: {
    type: string;
    multiplier?: number;
    lookup?: { clientScore: number; districtScore: number; label: string }[];
  };
  complianceThreshold?: number;
  naReason?: string;
  remarks?: string;
}

interface MappingFile {
  version: string;
  hospital: string;
  mappings: MappingEntry[];
}

@Injectable()
export class MappingsService {
  private readonly logger = new Logger(MappingsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async importMappings(fileContent: string, actorId: string) {
    let data: MappingFile;
    try {
      data = JSON.parse(fileContent);
    } catch {
      throw new BadRequestException('Invalid JSON file');
    }

    if (!data.mappings || !Array.isArray(data.mappings)) {
      throw new BadRequestException('Invalid mapping file: missing "mappings" array');
    }

    const importVersion = `v${data.version || '1'}-${Date.now()}`;
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const entry of data.mappings) {
      // Skip _comment keys
      if ((entry as any)._comment) continue;

      try {
        // Find or create client department
        const clientDept = await this.prisma.clientDepartment.findFirst({
          where: { code: entry.clientDepartment?.toUpperCase() },
        });

        if (!clientDept) {
          errors.push(`Skipped: client department "${entry.clientDepartment}" not found`);
          continue;
        }

        // Find or create client section
        let section = await this.prisma.clientSection.findFirst({
          where: { sectionName: entry.clientSectionName, clientDepartmentId: clientDept.id },
        });

        if (!section) {
          section = await this.prisma.clientSection.create({
            data: {
              sectionCode: `SEC-${Date.now()}`,
              sectionName: entry.clientSectionName,
              sectionOrder: 0,
              clientDepartmentId: clientDept.id,
            },
          });
        }

        // Find or create client checkpoint
        let checkpoint = await this.prisma.clientCheckpoint.findFirst({
          where: {
            checkpointCode: entry.clientCheckpointCode,
            clientSectionId: section.id,
          },
        });

        if (!checkpoint) {
          checkpoint = await this.prisma.clientCheckpoint.create({
            data: {
              checkpointCode: entry.clientCheckpointCode,
              description: entry.clientCheckpointDescription,
              maxScore: entry.clientMaxScore || 2,
              scoreOptions: entry.clientMaxScore === 2 ? [0, 1, 2] : [0, entry.clientMaxScore],
              checkpointOrder: 0,
              clientSectionId: section.id,
            },
          });
        }

        // Resolve NQAS ME
        let measurableElementId: string | null = null;
        const mappingType = entry.scoreMapping?.type?.toUpperCase();
        const isNa = mappingType === 'NOT_APPLICABLE' || !entry.districtMERef;

        if (!isNa && entry.districtMERef) {
          const me = await this.prisma.measurableElement.findFirst({
            where: { meRef: { contains: entry.districtMERef, mode: 'insensitive' } },
          });
          if (me) {
            measurableElementId = me.id;
          } else {
            errors.push(`Warning: NQAS ME "${entry.districtMERef}" not found — mapping set to N/A`);
          }
        }

        // Upsert mapping
        const existing = await this.prisma.checklistMapping.findUnique({
          where: { clientCheckpointId: checkpoint.id },
        });

        const mappingData = {
          measurableElementId,
          scoreMappingType: (mappingType as ScoreMappingType) || ScoreMappingType.DIRECT,
          scoreMappingFormula: entry.scoreMapping as any,
          complianceThreshold: entry.complianceThreshold || 70,
          isNa,
          naReason: entry.naReason || null,
          remarks: entry.remarks || null,
          importVersion,
        };

        if (existing) {
          await this.prisma.checklistMapping.update({
            where: { id: existing.id },
            data: mappingData,
          });
          updated++;
        } else {
          await this.prisma.checklistMapping.create({
            data: { clientCheckpointId: checkpoint.id, ...mappingData },
          });
          inserted++;
        }
      } catch (err) {
        errors.push(`Error processing checkpoint ${entry.clientCheckpointCode}: ${err.message}`);
      }
    }

    await this.audit.log({
      userId: actorId,
      action: 'IMPORT_MAPPINGS',
      resource: 'ChecklistMapping',
      newValue: { inserted, updated, errors: errors.length, version: importVersion },
    });

    this.logger.log(`Mapping import: ${inserted} inserted, ${updated} updated, ${errors.length} errors`);

    return {
      message: 'Mapping import complete',
      inserted,
      updated,
      totalProcessed: inserted + updated,
      errors: errors.slice(0, 20), // Return first 20 errors
      importVersion,
    };
  }

  async getMappings(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.checklistMapping.findMany({
        skip,
        take: limit,
        include: {
          clientCheckpoint: {
            include: {
              clientSection: { include: { clientDepartment: true } },
            },
          },
          measurableElement: {
            include: {
              standard: { include: { areaOfConcern: { include: { department: true } } } },
            },
          },
        },
        orderBy: { importedAt: 'desc' },
      }),
      this.prisma.checklistMapping.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getMappingStats() {
    const [total, mapped, na] = await Promise.all([
      this.prisma.checklistMapping.count(),
      this.prisma.checklistMapping.count({ where: { isNa: false, measurableElementId: { not: null } } }),
      this.prisma.checklistMapping.count({ where: { isNa: true } }),
    ]);
    return { total, mapped, na, unmapped: total - mapped - na };
  }
}
