import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateInterviewDto,
  RecordEventDto,
  SendMessageDto,
  SubmitCodingDto,
} from './dto/interview.dto';
import { InterviewsService } from './interviews.service';
import {
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  INTERVIEW_TYPES,
  PERSONALITIES,
  ROLES,
  TECHNICAL_TOPICS,
  TOPIC_DRIVEN_TYPES,
} from '../ai/interview.constants';
import { PLAN_LENGTH } from './interview-plan';

const PER_MINUTE = 60_000;

@Controller('interviews')
export class InterviewsController {
  constructor(private interviewsService: InterviewsService) {}

  @Get('config')
  getConfig() {
    return {
      roles: ROLES,
      experienceLevels: EXPERIENCE_LEVELS,
      interviewTypes: INTERVIEW_TYPES,
      technicalTopics: TECHNICAL_TOPICS,
      topicDrivenTypes: TOPIC_DRIVEN_TYPES,
      difficultyLevels: DIFFICULTY_LEVELS,
      personalities: PERSONALITIES,
      questionCounts: PLAN_LENGTH,
    };
  }

  @Throttle({ default: { limit: 6, ttl: PER_MINUTE } })
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateInterviewDto) {
    return this.interviewsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.interviewsService.findAll(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.interviewsService.findOne(user, id);
  }

  /** Server-Sent Events: `{content}` deltas, then `{turn}` or `{error}`, then `[DONE]`. */
  @Throttle({ default: { limit: 20, ttl: PER_MINUTE } })
  @Post(':id/message')
  async sendMessage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    await this.interviewsService.sendMessage(user, id, dto, res);
  }

  @Throttle({ default: { limit: 10, ttl: PER_MINUTE } })
  @Post(':id/complete')
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.interviewsService.complete(user, id);
  }

  @Throttle({ default: { limit: 60, ttl: PER_MINUTE } })
  @Post(':id/events')
  recordEvent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RecordEventDto,
  ) {
    return this.interviewsService.recordEvent(user, id, dto);
  }

  @Throttle({ default: { limit: 20, ttl: PER_MINUTE } })
  @Post(':id/coding')
  submitCoding(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SubmitCodingDto,
  ) {
    return this.interviewsService.submitCoding(user, id, dto);
  }
}
