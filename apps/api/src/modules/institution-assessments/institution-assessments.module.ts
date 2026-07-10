import { Module } from '@nestjs/common';
import { InstitutionAssessmentsController } from './institution-assessments.controller';
import { InstitutionAssessmentsService } from './institution-assessments.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InstitutionAssessmentsController],
  providers: [InstitutionAssessmentsService],
  exports: [InstitutionAssessmentsService],
})
export class InstitutionAssessmentsModule {}
