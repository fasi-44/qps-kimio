import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChecklistsService {
  constructor(private prisma: PrismaService) {}

  async getDepartments() {
    return this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { areasOfConcern: true } },
      },
    });
  }

  async getDepartmentStructure(departmentId: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        areasOfConcern: {
          orderBy: { order: 'asc' },
          include: {
            standards: {
              orderBy: { order: 'asc' },
              include: {
                measurableElements: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async getClientDepartments() {
    return this.prisma.clientDepartment.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { sections: true } },
      },
    });
  }

  async getClientDepartmentWithCheckpoints(clientDepartmentId: string) {
    const dept = await this.prisma.clientDepartment.findUnique({
      where: { id: clientDepartmentId },
      include: {
        sections: {
          orderBy: { sectionOrder: 'asc' },
          include: {
            checkpoints: {
              orderBy: { checkpointOrder: 'asc' },
              include: {
                mapping: {
                  include: {
                    measurableElement: {
                      include: {
                        standard: {
                          include: { areaOfConcern: true },
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
    if (!dept) throw new NotFoundException('Client department not found');
    return dept;
  }
}
