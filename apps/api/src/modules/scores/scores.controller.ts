import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ScoresService } from './scores.service';

@ApiTags('Scores')
@ApiBearerAuth('access-token')
@Controller('scores')
export class ScoresController {
  constructor(private service: ScoresService) {}

  @Get('assessment/:id/breakdown')
  @ApiOperation({ summary: 'Get score breakdown by area for an assessment' })
  getBreakdown(@Param('id') id: string) {
    return this.service.getAssessmentScoreBreakdown(id);
  }
}
