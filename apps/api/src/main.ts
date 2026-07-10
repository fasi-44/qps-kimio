import 'reflect-metadata';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Security
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  // CORS — allow the configured frontend origin(s) plus any *.onrender.com host
  // (so a Render-assigned hostname suffix can't silently break login).
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, server-to-server) send no Origin header.
      if (!origin) return callback(null, true);
      const ok =
        allowedOrigins.includes(origin) || /\.onrender\.com$/.test(new URL(origin).hostname);
      return callback(ok ? null : new Error(`Origin not allowed by CORS: ${origin}`), ok);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix);

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global interceptors
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NQAS Accreditation Platform API')
      .setDescription('Hospital NABH NQAS Assessment System — REST API')
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization' },
        'access-token',
      )
      .addTag('Auth', 'Authentication & password management')
      .addTag('Users', 'User management (Admin)')
      .addTag('Hospital', 'Hospital settings')
      .addTag('Checklists', 'NQAS department data')
      .addTag('Client Docs', 'Client checklist PDFs')
      .addTag('Mappings', 'Checklist mapping management')
      .addTag('Assessments', 'Assessment lifecycle')
      .addTag('Approvals', 'HOD approval workflow')
      .addTag('Scores', 'Score calculations')
      .addTag('Dashboard', 'Analytics & trends')
      .addTag('Notifications', 'In-app notifications')
      .addTag('Exports', 'Report exports')
      .addTag('Audit', 'Audit logs')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    console.log(
      `\n📚 Swagger docs: http://localhost:${process.env.API_PORT || 3001}/${apiPrefix}/docs\n`,
    );
  }

  // Serve uploaded documents statically at /uploads (outside the API prefix)
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Trust proxy (for nginx)
  app.set('trust proxy', 1);

  // Single-service deploy: Next.js owns Render's public $PORT and proxies
  // /api to this server, so the API binds a fixed internal port.
  const port = parseInt(process.env.API_PORT || '4000', 10);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 API running on http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
