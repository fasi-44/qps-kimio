import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CommitteesService } from './committees.service';
import {
  CreateCommitteeDto, UpdateCommitteeDto, UpdateCommitteeStatusDto,
} from './dto/committee.dto';
import { AddMemberDto, UpdateMemberDto, RemoveMemberDto } from './dto/member.dto';
import {
  CreatePositionTypeDto, UpdatePositionTypeDto,
  CreateDesignationDto, UpdateDesignationDto,
} from './dto/catalog.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, JwtPayload } from '@nabh/shared';

@ApiTags('Committees')
@ApiBearerAuth('access-token')
@Controller('committees')
export class CommitteesController {
  constructor(private service: CommitteesService) {}

  @Get()
  @ApiOperation({ summary: 'List committees' })
  findAll(
    @Query('page') page = 1, @Query('limit') limit = 20,
    @Query('status') status?: string, @Query('module') module?: string, @Query('q') q?: string,
  ) {
    return this.service.findAll(+page, +limit, { status, module, q });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Create committee' })
  create(@Body() dto: CreateCommitteeDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Committee dashboard metrics (FRS §10)' })
  getStats(@Query('module') module?: string) {
    return this.service.getStats(module);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get committee details (with active members + incumbents)' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Update committee' })
  update(@Param('id') id: string, @Body() dto: UpdateCommitteeDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.sub);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Activate / deactivate / archive committee' })
  setStatus(@Param('id') id: string, @Body() dto: UpdateCommitteeStatusDto, @CurrentUser() user: JwtPayload) {
    return this.service.setStatus(id, dto, user.sub);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Committee membership change history (FRS §3.4)' })
  getHistory(@Param('id') id: string) {
    return this.service.getHistory(id);
  }

  // ─── Members ────────────────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'List committee members' })
  listMembers(@Param('id') id: string, @Query('includeInactive') includeInactive?: string) {
    return this.service.listMembers(id, includeInactive === 'true');
  }

  @Post(':id/members')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Add committee member' })
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto, @CurrentUser() user: JwtPayload) {
    return this.service.addMember(id, dto, user.sub);
  }

  @Patch(':id/members/:memberId')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Update committee member (role / replacement)' })
  updateMember(
    @Param('id') id: string, @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto, @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateMember(id, memberId, dto, user.sub);
  }

  @Delete(':id/members/:memberId')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Remove committee member (soft — preserves history)' })
  removeMember(
    @Param('id') id: string, @Param('memberId') memberId: string,
    @Body() dto: RemoveMemberDto, @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeMember(id, memberId, dto, user.sub);
  }
}

@ApiTags('Committee Positions')
@ApiBearerAuth('access-token')
@Controller('committee-positions')
export class CommitteePositionsController {
  constructor(private service: CommitteesService) {}

  @Get()
  @ApiOperation({ summary: 'List committee position types' })
  list() {
    return this.service.listPositionTypes();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create position type' })
  create(@Body() dto: CreatePositionTypeDto, @CurrentUser() user: JwtPayload) {
    return this.service.createPositionType(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update position type' })
  update(@Param('id') id: string, @Body() dto: UpdatePositionTypeDto, @CurrentUser() user: JwtPayload) {
    return this.service.updatePositionType(id, dto, user.sub);
  }
}

@ApiTags('Designations')
@ApiBearerAuth('access-token')
@Controller('designations')
export class DesignationsController {
  constructor(private service: CommitteesService) {}

  @Get()
  @ApiOperation({ summary: 'List designations' })
  list(@Query('includeInactive') includeInactive?: string) {
    return this.service.listDesignations(includeInactive === 'true');
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create designation' })
  create(@Body() dto: CreateDesignationDto, @CurrentUser() user: JwtPayload) {
    return this.service.createDesignation(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update designation' })
  update(@Param('id') id: string, @Body() dto: UpdateDesignationDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateDesignation(id, dto, user.sub);
  }
}
