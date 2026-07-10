import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { ScoresModule } from '../scores/scores.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ScoresModule, AuditModule],
  providers: [AssessmentsService],
  controllers: [AssessmentsController],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
