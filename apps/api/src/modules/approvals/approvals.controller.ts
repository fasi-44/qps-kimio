import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@nabh/shared';

class ReviewDto {
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

@ApiTags('Approvals')
@ApiBearerAuth('access-token')
@Roles(UserRole.HOD, UserRole.ADMIN)
@Controller('approvals')
export class ApprovalsController {
  constructor(private service: ApprovalsService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Get assessments pending review' })
  getPending(@CurrentUser() user: any) {
    return this.service.getPendingApprovals(user.sub, user.role as UserRole);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve an assessment' })
  approve(@Param('id') id: string, @Body() body: ReviewDto, @CurrentUser() user: any) {
    return this.service.approve(id, user.sub, body.remarks);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an assessment' })
  reject(@Param('id') id: string, @Body() body: ReviewDto, @CurrentUser() user: any) {
    return this.service.reject(id, user.sub, body.remarks);
  }

  @Post(':id/send-back')
  @ApiOperation({ summary: 'Send assessment back for revision' })
  sendBack(@Param('id') id: string, @Body() body: ReviewDto, @CurrentUser() user: any) {
    return this.service.sendBack(id, user.sub, body.remarks);
  }
}
