import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InstitutionAssessmentsService } from './institution-assessments.service';
import { CreateInstitutionAssessmentDto } from './dto/institution-assessment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@nabh/shared';

@ApiTags('Institution Assessments')
@ApiBearerAuth('access-token')
@Controller('institution-assessments')
export class InstitutionAssessmentsController {
  constructor(private service: InstitutionAssessmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create institution assessment (Admin only)' })
  create(@Body() dto: CreateInstitutionAssessmentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List institution assessments' })
  findAll(
    @Query('module') module?: string,
    @Query('year') year?: string,
  ) {
    return this.service.findAll({ module, year: year ? +year : undefined });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get institution assessment with dept status' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Generate Department Wise compliance report' })
  getReport(@Param('id') id: string) {
    return this.service.getReport(id);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare multiple institution assessments' })
  compare(@Query('ids') ids: string) {
    return this.service.compare(ids.split(',').filter(Boolean));
  }
}
