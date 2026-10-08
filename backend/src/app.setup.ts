import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

/**
 * Global HTTP pipeline shared by the real server and the integration tests,
 * so tests exercise exactly what runs in production.
 */
export function configureApp(app: INestApplication): void {
  // Auth uses bearer tokens, not cookies, so credentials are not needed.
  // Without FRONTEND_URL (development only — enforced by validateEnv) any
  // origin is reflected.
  app.enableCors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL : true,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');
}
