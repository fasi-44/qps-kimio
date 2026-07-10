import { Module } from '@nestjs/common';
import { MappingsService } from './mappings.service';
import { MappingsController } from './mappings.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [MappingsService],
  controllers: [MappingsController],
  exports: [MappingsService],
})
export class MappingsModule {}
