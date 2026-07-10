import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, AppModule } from '@nabh/shared';

const ALL_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HOD, UserRole.ASSESSOR];

// Page keys must match the dashboard nav hrefs (href.slice(1)) or items get hidden.
const DEFAULT_PAGE_ACCESS: Record<UserRole, string[]> = {
  // Super Admin: everything Admin can do, plus exclusive KPI template config.
  [UserRole.SUPER_ADMIN]: ['dashboard', 'assessment-cycles', 'approvals', 'committees', 'reports', 'users', 'email-templates', 'audit-logs', 'settings', 'indicators', 'kpi-templates'],
  [UserRole.ADMIN]:    ['dashboard', 'assessment-cycles', 'approvals', 'committees', 'reports', 'users', 'email-templates', 'audit-logs', 'settings', 'indicators'],
  [UserRole.HOD]:      ['dashboard', 'assessment-cycles', 'approvals', 'committees', 'reports'],
  [UserRole.ASSESSOR]: ['dashboard', 'assessment-cycles', 'committees', 'reports'],
};

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getRolePermissions() {
    const records = await this.prisma.rolePermission.findMany();
    const map = new Map(records.map((r) => [r.role as string, r]));
    return ALL_ROLES.map((role) => {
      const rec = map.get(role);
      return {
        role,
        moduleAccess: (rec?.moduleAccess ?? ['NQAS']) as AppModule[],
        pageAccess: (rec?.pageAccess ?? DEFAULT_PAGE_ACCESS[role]) as string[],
      };
    });
  }

  async updateRolePermissions(role: UserRole, body: { moduleAccess?: AppModule[]; pageAccess?: string[] }) {
    const existing = await this.prisma.rolePermission.findUnique({ where: { role } });
    return this.prisma.rolePermission.upsert({
      where: { role },
      update: body,
      create: {
        role,
        moduleAccess: body.moduleAccess ?? (existing?.moduleAccess as AppModule[]) ?? ['NQAS'],
        pageAccess: body.pageAccess ?? existing?.pageAccess ?? DEFAULT_PAGE_ACCESS[role],
      },
    });
  }

  async getModulesForRole(role: UserRole): Promise<AppModule[]> {
    const perm = await this.prisma.rolePermission.findUnique({ where: { role } });
    return (perm?.moduleAccess ?? ['NQAS']) as AppModule[];
  }
}
