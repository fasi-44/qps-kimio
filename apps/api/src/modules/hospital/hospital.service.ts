import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HospitalService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.hospitalSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.hospitalSettings.create({
        data: { name: 'Hospital Name' },
      });
    }
    return settings;
  }

  async updateSettings(data: any) {
    const settings = await this.getSettings();
    return this.prisma.hospitalSettings.update({
      where: { id: settings.id },
      data,
    });
  }
}
