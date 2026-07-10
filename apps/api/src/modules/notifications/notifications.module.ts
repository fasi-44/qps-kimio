import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { MailService } from './mail.service';

@Module({
  providers: [NotificationsGateway, NotificationsService, MailService],
  controllers: [NotificationsController],
  exports: [NotificationsService, MailService],
})
export class NotificationsModule {}
