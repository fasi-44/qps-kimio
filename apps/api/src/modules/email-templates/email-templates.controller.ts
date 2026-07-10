import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, JwtPayload } from '@nabh/shared';

@ApiTags('Email Templates')
@ApiBearerAuth('access-token')
@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private service: EmailTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List email templates' })
  findAll(@Query('category') category?: string, @Query('active') active?: string) {
    return this.service.findAll(category, active === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an email template' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an email template' })
  create(@Body() dto: CreateEmailTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an email template' })
  update(@Param('id') id: string, @Body() dto: UpdateEmailTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an email template' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.sub);
  }
}
