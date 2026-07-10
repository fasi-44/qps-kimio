import {
  Controller, Get, Post, Put, Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MinutesService } from './minutes.service';
import { SaveMinutesDto, TransitionMinutesDto } from './dto/minutes.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, JwtPayload } from '@nabh/shared';

@ApiTags('Committee Minutes')
@ApiBearerAuth('access-token')
@Controller('meetings/:meetingId/minutes')
export class MinutesController {
  constructor(private service: MinutesService) {}

  @Get()
  @ApiOperation({ summary: 'Get minutes for a meeting' })
  get(@Param('meetingId') meetingId: string) {
    return this.service.get(meetingId);
  }

  @Put()
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Create / update draft minutes (direct entry or upload)' })
  save(@Param('meetingId') meetingId: string, @Body() dto: SaveMinutesDto, @CurrentUser() user: JwtPayload) {
    return this.service.save(meetingId, dto, user);
  }

  @Post('transition')
  @Roles(UserRole.ADMIN, UserRole.HOD)
  @ApiOperation({ summary: 'Workflow transition: SUBMIT / APPROVE / PUBLISH / SEND_BACK' })
  transition(@Param('meetingId') meetingId: string, @Body() dto: TransitionMinutesDto, @CurrentUser() user: JwtPayload) {
    return this.service.transition(meetingId, dto, user);
  }
}
