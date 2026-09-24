import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { validateEnv } from './common/env.validation';

async function bootstrap() {
  validateEnv(process.env);

  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.enableCors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL : true,
    credentials: true,
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
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(
    `InterviewPilot API running on http://localhost:${port}`,
    'Bootstrap',
  );
}

void bootstrap();
