import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { InterviewsModule } from './interviews/interviews.module';
import { ResumeModule } from './resume/resume.module';
import { CodingModule } from './coding/coding.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './common/health.controller';
import { AuthGuard } from './auth/auth.guard';
import { UserThrottlerGuard } from './auth/user-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default budget for every route; AI and code-execution endpoints set
    // tighter limits with @Throttle. In-memory storage: per instance.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      errorMessage: 'Too many requests. Please wait a moment and try again.',
    }),
    PrismaModule,
    AiModule,
    InterviewsModule,
    ResumeModule,
    CodingModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first so throttling can key on the user.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule {}
