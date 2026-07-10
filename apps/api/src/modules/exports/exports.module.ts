import { Module } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { ExportsController } from './exports.controller';
import { ScoresModule } from '../scores/scores.module';

@Module({
  imports: [ScoresModule],
  providers: [ExportsService],
  controllers: [ExportsController],
})
export class ExportsModule {}
