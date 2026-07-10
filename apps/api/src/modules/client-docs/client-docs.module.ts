import { Module } from '@nestjs/common';
import { ClientDocsService } from './client-docs.service';
import { ClientDocsController } from './client-docs.controller';

@Module({
  providers: [ClientDocsService],
  controllers: [ClientDocsController],
  exports: [ClientDocsService],
})
export class ClientDocsModule {}
