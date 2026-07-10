import {
  Controller, Get, Post, Patch, Delete, Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgendaService } from './agenda.service';
import { SubmitAgendaDto, UpdateAgendaDto, ReviewAgendaDto } from './dto/agenda.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@nabh/shared';

@ApiTags('Committee Agenda')
@ApiBearerAuth('access-token')
@Controller()
export class AgendaController {
  constructor(private service: AgendaService) {}

  @Get('meetings/:meetingId/agenda')
  @ApiOperation({ summary: 'List agenda items for a meeting' })
  list(@Param('meetingId') meetingId: string) {
    return this.service.list(meetingId);
  }

  @Post('meetings/:meetingId/agenda')
  @ApiOperation({ summary: 'Submit an agenda item' })
  submit(@Param('meetingId') meetingId: string, @Body() dto: SubmitAgendaDto, @CurrentUser() user: JwtPayload) {
    return this.service.submit(meetingId, dto, user);
  }

  @Post('meetings/:meetingId/agenda/publish')
  @ApiOperation({ summary: 'Publish accepted agenda items (Chairperson / Member Secretary)' })
  publish(@Param('meetingId') meetingId: string, @CurrentUser() user: JwtPayload) {
    return this.service.publish(meetingId, user);
  }

  @Patch('agenda/:id')
  @ApiOperation({ summary: 'Update an agenda item (submitter)' })
  update(@Param('id') id: string, @Body() dto: UpdateAgendaDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Post('agenda/:id/review')
  @ApiOperation({ summary: 'Accept / reject / request clarification (Chairperson / Member Secretary)' })
  review(@Param('id') id: string, @Body() dto: ReviewAgendaDto, @CurrentUser() user: JwtPayload) {
    return this.service.review(id, dto, user);
  }

  @Delete('agenda/:id')
  @ApiOperation({ summary: 'Delete an agenda item (submitter)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
