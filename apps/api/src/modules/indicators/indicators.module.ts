import { Module } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { IndicatorsController } from './indicators.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [IndicatorsService],
  controllers: [IndicatorsController],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
