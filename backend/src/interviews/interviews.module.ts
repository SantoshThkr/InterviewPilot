import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { AiModule } from '../ai/ai.module';
import { CodingModule } from '../coding/coding.module';

@Module({
  imports: [AiModule, CodingModule],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}
