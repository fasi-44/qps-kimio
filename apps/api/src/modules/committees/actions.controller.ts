import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ActionsService } from './actions.service';
import {
  CreateActionDto, UpdateActionDto, UpdateActionStatusDto, AddEvidenceDto,
  CloseReopenDto, CarryForwardDto,
} from './dto/action.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, JwtPayload } from '@nabh/shared';

@ApiTags('Committee Actions')
@ApiBearerAuth('access-token')
@Controller()
export class ActionsController {
  constructor(private service: ActionsService) {}

  @Get('committees/:committeeId/actions')
  @ApiOperation({ summary: 'List action items for a committee' })
  list(
    @Param('committeeId') committeeId: string,
    @Query('status') status?: string,
    @Query('meetingId') meetingId?: string,
    @Query('overdueOnly') overdueOnly?: string,
  ) {
    return this.service.list(committeeId, { status, meetingId, overdueOnly: overdueOnly === 'true' });
  }

  @Post('committees/:committeeId/actions')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Create an action item' })
  create(@Param('committeeId') committeeId: string, @Body() dto: CreateActionDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(committeeId, dto, user);
  }

  @Get('meetings/:meetingId/actions')
  @ApiOperation({ summary: 'Actions raised in a meeting + carried-forward open items (FRS §9)' })
  forMeeting(@Param('meetingId') meetingId: string) {
    return this.service.listForMeeting(meetingId);
  }

  @Get('actions/:id')
  @ApiOperation({ summary: 'Get action item (with carry-forward history)' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('actions/:id')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Update action item' })
  update(@Param('id') id: string, @Body() dto: UpdateActionDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete('actions/:id')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Delete an action item' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }

  @Patch('actions/:id/status')
  @ApiOperation({ summary: 'Update progress status (responsible person or manager)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateActionStatusDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateStatus(id, dto, user);
  }

  @Post('actions/:id/evidence')
  @ApiOperation({ summary: 'Attach evidence of completion' })
  addEvidence(@Param('id') id: string, @Body() dto: AddEvidenceDto, @CurrentUser() user: JwtPayload) {
    return this.service.addEvidence(id, dto, user);
  }

  @Post('actions/:id/close')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Approve closure (Chairperson / Committee Secretary)' })
  close(@Param('id') id: string, @Body() dto: CloseReopenDto, @CurrentUser() user: JwtPayload) {
    return this.service.close(id, dto, user);
  }

  @Post('actions/:id/reopen')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Reopen a closed action' })
  reopen(@Param('id') id: string, @Body() dto: CloseReopenDto, @CurrentUser() user: JwtPayload) {
    return this.service.reopen(id, dto, user);
  }

  @Post('actions/:id/carry-forward')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Carry forward / continue / escalate / close a pending action' })
  carryForward(@Param('id') id: string, @Body() dto: CarryForwardDto, @CurrentUser() user: JwtPayload) {
    return this.service.carryForward(id, dto, user);
  }

  @Get('actions/:id/carry-forwards')
  @ApiOperation({ summary: 'Carry-forward history for an action' })
  carryForwards(@Param('id') id: string) {
    return this.service.getCarryForwards(id);
  }
}
