import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@nabh/shared';

@ApiTags('Exports')
@ApiBearerAuth('access-token')
@Roles(UserRole.HOD, UserRole.ADMIN)
@Controller('exports')
export class ExportsController {
  constructor(private service: ExportsService) {}

  @Get('assessment/:id/excel')
  @ApiOperation({ summary: 'Export assessment scorecard as Excel' })
  async exportExcel(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.service.exportAssessmentExcel(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="assessment-${id}.xlsx"`);
    res.send(buffer);
  }
}
