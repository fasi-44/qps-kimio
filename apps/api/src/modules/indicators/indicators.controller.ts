import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IndicatorsService } from './indicators.service';
import {
  CreateIndicatorTypeDto, UpdateIndicatorTypeDto,
  CreateIndicatorTemplateDto, UpdateIndicatorTemplateDto,
  UpsertIndicatorEntryDto, BulkUpsertEntriesDto, PreviewComputeDto,
} from './dto/indicator.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, JwtPayload } from '@nabh/shared';

/**
 * Quality & Patient Safety — KPI / Outcome indicators.
 *
 * Class-level @Roles(ADMIN) gates the whole module to Admin + Super Admin
 * (Super Admin is a superset, see RolesGuard). Template/Type *configuration*
 * writes are further restricted to Super Admin; data-entry stays Admin-level.
 */
@ApiTags('Indicators')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN)
@Controller('indicators')
export class IndicatorsController {
  constructor(private service: IndicatorsService) {}

  // ── Types ──
  @Get('types')
  @ApiOperation({ summary: 'List indicator types' })
  listTypes(
    @Query('framework') framework?: string,
    @Query('departmentCode') departmentCode?: string,
    @Query('active') active?: string,
  ) {
    return this.service.listTypes(framework, departmentCode, active === 'true');
  }

  @Post('types')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create an indicator type (Super Admin)' })
  createType(@Body() dto: CreateIndicatorTypeDto, @CurrentUser() user: JwtPayload) {
    return this.service.createType(dto, user.sub);
  }

  @Patch('types/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an indicator type (Super Admin)' })
  updateType(@Param('id') id: string, @Body() dto: UpdateIndicatorTypeDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateType(id, dto, user.sub);
  }

  @Delete('types/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an indicator type (Super Admin)' })
  removeType(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeType(id, user.sub);
  }

  // ── Templates ──
  @Get('templates')
  @ApiOperation({ summary: 'List indicator templates' })
  listTemplates(
    @Query('framework') framework?: string,
    @Query('typeId') typeId?: string,
    @Query('departmentCode') departmentCode?: string,
    @Query('active') active?: string,
  ) {
    return this.service.listTemplates({ framework, typeId, departmentCode, activeOnly: active === 'true' });
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get an indicator template' })
  getTemplate(@Param('id') id: string) {
    return this.service.getTemplate(id);
  }

  @Get('templates/:id/history')
  @ApiOperation({ summary: 'Monthly entry history for an indicator' })
  templateHistory(@Param('id') id: string) {
    return this.service.templateHistory(id);
  }

  @Post('templates')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create an indicator template (Super Admin)' })
  createTemplate(@Body() dto: CreateIndicatorTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTemplate(dto, user.sub);
  }

  @Patch('templates/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an indicator template (Super Admin)' })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateIndicatorTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateTemplate(id, dto, user.sub);
  }

  @Delete('templates/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an indicator template (Super Admin)' })
  removeTemplate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeTemplate(id, user.sub);
  }

  // ── Entries (Admin data entry) ──
  @Get('entries')
  @ApiOperation({ summary: 'List indicator entries' })
  listEntries(
    @Query('templateId') templateId?: string,
    @Query('framework') framework?: string,
    @Query('departmentCode') departmentCode?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.service.listEntries({
      templateId, framework, departmentCode,
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
    });
  }

  @Post('entries')
  @ApiOperation({ summary: 'Create/update a monthly entry — auto-computes the result' })
  upsertEntry(@Body() dto: UpsertIndicatorEntryDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsertEntry(dto, user.sub);
  }

  @Post('entries/bulk')
  @ApiOperation({ summary: 'Create/update many monthly entries at once (Save all)' })
  bulkUpsert(@Body() dto: BulkUpsertEntriesDto, @CurrentUser() user: JwtPayload) {
    return this.service.bulkUpsert(dto.entries, user.sub);
  }

  @Delete('entries/:id')
  @ApiOperation({ summary: 'Delete a monthly entry' })
  deleteEntry(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.deleteEntry(id, user.sub);
  }

  // ── Live preview ──
  @Post('preview')
  @ApiOperation({ summary: 'Compute a result from inputs without saving' })
  preview(@Body() dto: PreviewComputeDto) {
    return this.service.preview(dto);
  }
}
