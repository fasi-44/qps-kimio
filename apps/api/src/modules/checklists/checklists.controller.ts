import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChecklistsService } from './checklists.service';

@ApiTags('Checklists')
@ApiBearerAuth('access-token')
@Controller('checklists')
export class ChecklistsController {
  constructor(private service: ChecklistsService) {}

  @Get('departments')
  @ApiOperation({ summary: 'Get all NQAS departments' })
  getDepartments() { return this.service.getDepartments(); }

  @Get('departments/:id/structure')
  @ApiOperation({ summary: 'Get full NQAS department structure (areas, standards, MEs)' })
  getDeptStructure(@Param('id') id: string) { return this.service.getDepartmentStructure(id); }

  @Get('client-departments')
  @ApiOperation({ summary: 'Get client department list' })
  getClientDepts() { return this.service.getClientDepartments(); }

  @Get('client-departments/:id')
  @ApiOperation({ summary: 'Get client department with sections & checkpoints' })
  getClientDept(@Param('id') id: string) {
    return this.service.getClientDepartmentWithCheckpoints(id);
  }
}
