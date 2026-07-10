import {
  Controller, Get, Post, Patch, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import {
  CreateMeetingDto, UpdateMeetingDto, RescheduleMeetingDto, CancelMeetingDto, SaveAttendanceDto,
} from './dto/meeting.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, JwtPayload } from '@nabh/shared';

@ApiTags('Committee Meetings')
@ApiBearerAuth('access-token')
@Controller('committees/:committeeId/meetings')
export class CommitteeMeetingsController {
  constructor(private service: MeetingsService) {}

  @Get()
  @ApiOperation({ summary: 'List meetings for a committee' })
  list(
    @Param('committeeId') committeeId: string,
    @Query('status') status?: string,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.service.list(committeeId, { status, upcoming: upcoming === 'true' });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Schedule a meeting (one-time or recurring series)' })
  create(@Param('committeeId') committeeId: string, @Body() dto: CreateMeetingDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(committeeId, dto, user.sub);
  }
}

@ApiTags('Committee Meetings')
@ApiBearerAuth('access-token')
@Controller('meetings')
export class MeetingsController {
  constructor(private service: MeetingsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get meeting details' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Update meeting' })
  update(@Param('id') id: string, @Body() dto: UpdateMeetingDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.sub);
  }

  @Post(':id/reschedule')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Reschedule meeting' })
  reschedule(@Param('id') id: string, @Body() dto: RescheduleMeetingDto, @CurrentUser() user: JwtPayload) {
    return this.service.reschedule(id, dto, user.sub);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Cancel meeting' })
  cancel(@Param('id') id: string, @Body() dto: CancelMeetingDto, @CurrentUser() user: JwtPayload) {
    return this.service.cancel(id, dto, user.sub);
  }

  @Get(':id/attendance')
  @ApiOperation({ summary: 'Get meeting attendance' })
  getAttendance(@Param('id') id: string) {
    return this.service.getAttendance(id);
  }

  @Post(':id/attendance')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Record / update meeting attendance' })
  saveAttendance(@Param('id') id: string, @Body() dto: SaveAttendanceDto, @CurrentUser() user: JwtPayload) {
    return this.service.saveAttendance(id, dto, user.sub);
  }
}
