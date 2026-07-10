import { Module } from '@nestjs/common';
import { CommitteesService } from './committees.service';
import { MeetingsService } from './meetings.service';
import { AgendaService } from './agenda.service';
import { MinutesService } from './minutes.service';
import { ActionsService } from './actions.service';
import {
  CommitteesController, CommitteePositionsController, DesignationsController,
} from './committees.controller';
import { CommitteeMeetingsController, MeetingsController } from './meetings.controller';
import { AgendaController } from './agenda.controller';
import { MinutesController } from './minutes.controller';
import { ActionsController } from './actions.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [CommitteesService, MeetingsService, AgendaService, MinutesService, ActionsService],
  controllers: [
    CommitteesController,
    CommitteePositionsController,
    DesignationsController,
    CommitteeMeetingsController,
    MeetingsController,
    AgendaController,
    MinutesController,
    ActionsController,
  ],
  exports: [CommitteesService, MeetingsService, AgendaService, MinutesService, ActionsService],
})
export class CommitteesModule {}
