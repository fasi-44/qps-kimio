import {
  Controller, Get, Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { MappingsService } from './mappings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@nabh/shared';

@ApiTags('Mappings')
@ApiBearerAuth('access-token')
@Controller('mappings')
export class MappingsController {
  constructor(private service: MappingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all mappings (paginated)' })
  getMappings(@Query('page') page = 1, @Query('limit') limit = 50) {
    return this.service.getMappings(+page, +limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get mapping statistics' })
  getStats() { return this.service.getMappingStats(); }

  @Post('import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Import mapping JSON file (Admin, upsert-safe)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importMappings(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (!file) throw new Error('No file uploaded');
    const content = file.buffer.toString('utf-8');
    return this.service.importMappings(content, user.sub);
  }
}
