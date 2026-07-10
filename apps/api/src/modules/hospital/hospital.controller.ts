import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HospitalService } from './hospital.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@nabh/shared';

@ApiTags('Hospital')
@ApiBearerAuth('access-token')
@Controller('hospital')
export class HospitalController {
  constructor(private service: HospitalService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get hospital settings' })
  getSettings() { return this.service.getSettings(); }

  @Patch('settings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update hospital settings (Admin)' })
  updateSettings(@Body() body: any) { return this.service.updateSettings(body); }
}
