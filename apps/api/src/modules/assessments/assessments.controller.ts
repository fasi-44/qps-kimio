import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import {
  CreateAssessmentDto, SaveSectionResponsesDto, UpdateAssessmentNotesDto,
} from './dto/assessment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@nabh/shared';

@ApiTags('Assessments')
@ApiBearerAuth('access-token')
@Controller('assessments')
export class AssessmentsController {
  constructor(private service: AssessmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List assessments (filtered by role)' })
  findAll(
    @CurrentUser() user: any,
    @Query('page') page = 1, @Query('limit') limit = 20,
    @Query('status') status?: string, @Query('quarter') quarter?: string,
    @Query('year') year?: string, @Query('departmentId') departmentId?: string,
    @Query('module') module?: string, @Query('institutionAssessmentId') institutionAssessmentId?: string,
  ) {
    return this.service.findAll(user.sub, user.role as UserRole, +page, +limit, { status, quarter, year, departmentId, module, institutionAssessmentId });
  }

  @Post()
  @ApiOperation({ summary: 'Create new assessment (Assessor)' })
  create(@Body() dto: CreateAssessmentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Post('seed-demo')
  @Public()
  @ApiOperation({ summary: '[DEV] Create assessments for all departments in a cycle with random scores (no auth)' })
  seedDemo(@Query('cycleId') cycleId: string, @Query('userId') userId: string) {
    return this.service.seedDemoAssessments(cycleId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assessment details' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.sub, user.role as UserRole);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start / resume assessment wizard' })
  start(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.startAssessment(id, user.sub);
  }

  @Post(':id/sections/responses')
  @ApiOperation({ summary: 'Auto-save section responses (wizard step save)' })
  saveSectionResponses(
    @Param('id') id: string,
    @Body() dto: SaveSectionResponsesDto,
    @CurrentUser() user: any,
  ) {
    return this.service.saveSectionResponses(id, dto, user.sub);
  }

  @Get(':id/sections/:sectionCode/responses')
  @ApiOperation({ summary: 'Load saved responses for a section (resume wizard)' })
  getSectionResponses(
    @Param('id') id: string,
    @Param('sectionCode') sectionCode: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getSectionResponses(id, sectionCode, user.sub, user.role as UserRole);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit assessment for HOD review' })
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.submit(id, user.sub);
  }

  @Patch(':id/notes')
  @ApiOperation({ summary: 'Update assessment notes/strengths/recommendations' })
  updateNotes(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentNotesDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateNotes(id, dto, user.sub);
  }

  @Get(':id/wizard')
  @ApiOperation({ summary: 'Get assessment wizard data (sections + completion)' })
  getWizardInfo(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getWizardInfo(id, user.sub, user.role as UserRole);
  }

  @Get(':id/sections/:sectionCode/checkpoints')
  @ApiOperation({ summary: 'Get checkpoints for a section (with mapping info)' })
  getSectionCheckpoints(
    @Param('id') id: string,
    @Param('sectionCode') sectionCode: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getSectionCheckpoints(id, sectionCode, user.sub, user.role as UserRole);
  }
}
