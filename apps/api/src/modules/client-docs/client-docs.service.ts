import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ClientDocsService {
  private readonly logger = new Logger(ClientDocsService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'client-docs');

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async getClientDepartments() {
    return this.prisma.clientDepartment.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { _count: { select: { sections: true } } },
    });
  }

  async createClientDepartment(data: {
    code: string; name: string; pdfFileName: string; order: number;
  }) {
    return this.prisma.clientDepartment.upsert({
      where: { code: data.code.toUpperCase() },
      update: { name: data.name, pdfFileName: data.pdfFileName },
      create: { ...data, code: data.code.toUpperCase() },
    });
  }
}
