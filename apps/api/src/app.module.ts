import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HospitalModule } from './modules/hospital/hospital.module';
import { ChecklistsModule } from './modules/checklists/checklists.module';
import { ClientDocsModule } from './modules/client-docs/client-docs.module';
import { MappingsModule } from './modules/mappings/mappings.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ScoresModule } from './modules/scores/scores.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ExportsModule } from './modules/exports/exports.module';
import { AuditModule } from './modules/audit/audit.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { InstitutionAssessmentsModule } from './modules/institution-assessments/institution-assessments.module';
import { CommitteesModule } from './modules/committees/committees.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL', 60000),
            limit: config.get('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // Winston logging
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, context }) =>
                `${timestamp} [${context || 'App'}] ${level}: ${message}`,
            ),
          ),
        }),
        new DailyRotateFile({
          filename: 'logs/app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    }),

    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    HospitalModule,
    ChecklistsModule,
    ClientDocsModule,
    MappingsModule,
    AssessmentsModule,
    ApprovalsModule,
    ScoresModule,
    DashboardModule,
    NotificationsModule,
    ExportsModule,
    AuditModule,
    PermissionsModule,
    InstitutionAssessmentsModule,
    CommitteesModule,
    UploadsModule,
    EmailTemplatesModule,
    IndicatorsModule,
  ],
  providers: [
    // Global guards
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
