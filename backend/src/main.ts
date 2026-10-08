import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { validateEnv } from './common/env.validation';

async function bootstrap() {
  validateEnv(process.env);

  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  configureApp(app);
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(
    `InterviewPilot API running on http://localhost:${port}`,
    'Bootstrap',
  );
}

void bootstrap();
