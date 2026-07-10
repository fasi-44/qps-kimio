import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Overview stats' })
  getOverview() { return this.service.getOverview(); }

  @Get('department-scores')
  @ApiOperation({ summary: 'Latest compliance scores per department' })
  getDeptScores(@Query('year') year?: number) { return this.service.getDepartmentScores(year); }

  @Get('quarterly-trends')
  @ApiOperation({ summary: 'Quarter-over-quarter compliance trends' })
  getTrends(@Query('departmentId') deptId?: string) { return this.service.getQuarterlyTrends(deptId); }

  @Get('area-breakdown')
  @ApiOperation({ summary: 'Area of concern wise breakdown (current year)' })
  getAreaBreakdown(@Query('year') year?: number) { return this.service.getAreaWiseBreakdown(year); }
}
