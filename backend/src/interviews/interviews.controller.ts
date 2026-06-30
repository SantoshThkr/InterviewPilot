import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
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
} from '../ai/interview.constants';

@Controller('interviews')
@UseGuards(AuthGuard)
export class InterviewsController {
  constructor(private interviewsService: InterviewsService) {}

  @Get('config')
  getConfig() {
    return {
      roles: ROLES,
      experienceLevels: EXPERIENCE_LEVELS,
      interviewTypes: INTERVIEW_TYPES,
      technicalTopics: TECHNICAL_TOPICS,
      difficultyLevels: DIFFICULTY_LEVELS,
      personalities: PERSONALITIES,
    };
  }

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

  @Post(':id/message')
  async sendMessage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    await this.interviewsService.sendMessage(user, id, dto.content, res);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.interviewsService.complete(user, id);
  }

  @Post(':id/events')
  recordEvent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RecordEventDto,
  ) {
    return this.interviewsService.recordEvent(user, id, dto);
  }

  @Post(':id/coding')
  submitCoding(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SubmitCodingDto,
  ) {
    return this.interviewsService.submitCoding(user, id, dto);
  }
}
