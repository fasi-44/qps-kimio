import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClientDocsService } from './client-docs.service';

@ApiTags('Client Docs')
@ApiBearerAuth('access-token')
@Controller('client-docs')
export class ClientDocsController {
  constructor(private service: ClientDocsService) {}

  @Get('departments')
  @ApiOperation({ summary: 'Get client department list' })
  getDepartments() { return this.service.getClientDepartments(); }
}
