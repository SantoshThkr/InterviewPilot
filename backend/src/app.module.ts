import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { InterviewsModule } from './interviews/interviews.module';
import { ResumeModule } from './resume/resume.module';
import { CodingModule } from './coding/coding.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiModule,
    InterviewsModule,
    ResumeModule,
    CodingModule,
    DashboardModule,
  ],
})
export class AppModule {}
