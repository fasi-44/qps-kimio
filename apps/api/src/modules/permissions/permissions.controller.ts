import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, AppModule } from '@nabh/shared';

@ApiTags('Permissions')
@ApiBearerAuth('access-token')
@Controller('permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Get module and page access for all roles' })
  getRolePermissions() {
    return this.service.getRolePermissions();
  }

  @Patch('roles/:role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update module and page access for a role (Admin)' })
  updateRolePermissions(
    @Param('role') role: UserRole,
    @Body() body: { moduleAccess?: AppModule[]; pageAccess?: string[] },
  ) {
    return this.service.updateRolePermissions(role, body);
  }
}
