import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InterviewStatus, MessageRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { Response } from 'express';
import { AiService } from '../ai/ai.service';
import { InterviewConfig } from '../ai/interview.constants';
import { CodingService } from '../coding/coding.service';
import { getProblemById } from '../coding/coding.problems';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInterviewDto,
  RecordEventDto,
  SubmitCodingDto,
} from './dto/interview.dto';

@Injectable()
export class InterviewsService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private codingService: CodingService,
  ) {}

  async create(user: User, dto: CreateInterviewDto) {
    let resumeContent: string | undefined;

    if (dto.includeResume && dto.resumeId) {
      const resume = await this.prisma.resume.findFirst({
        where: { id: dto.resumeId, userId: user.id },
      });
      if (resume) resumeContent = resume.content;
    } else if (dto.includeResume) {
      const activeResume = await this.prisma.resume.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (activeResume) resumeContent = activeResume.content;
    }

    const weakAreas = await this.prisma.userWeakArea.findMany({
      where: { userId: user.id },
      orderBy: { struggleCount: 'desc' },
      take: 5,
    });

    const adaptiveTopics = [
      ...new Set([...dto.topics, ...weakAreas.map((w) => w.topic)]),
    ];

    const config: InterviewConfig = {
      role: dto.role,
      experience: dto.experience,
      type: dto.type,
      difficulty: dto.difficulty,
      personality: dto.personality,
      topics: adaptiveTopics,
      includeCoding: dto.includeCoding ?? true,
      includeResume: dto.includeResume ?? true,
      examMode: dto.examMode ?? false,
    };

    const interview = await this.prisma.interview.create({
      data: {
        userId: user.id,
        role: dto.role,
        experience: dto.experience,
        type: dto.type as never,
        difficulty: dto.difficulty,
        personality: dto.personality,
        topics: adaptiveTopics,
        resumeId: dto.resumeId,
        config: config as never,
        status: InterviewStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    const opening = await this.ai.generateOpening(config, resumeContent);

    await this.prisma.interviewMessage.create({
      data: {
        interviewId: interview.id,
        role: MessageRole.INTERVIEWER,
        content: opening,
      },
    });

    return { interview, openingMessage: opening };
  }

  async findAll(user: User) {
    return this.prisma.interview.findMany({
      where: { userId: user.id },
      include: { report: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: User, id: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, userId: user.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        report: true,
        codingSubs: true,
        events: true,
      },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }

  async sendMessage(user: User, id: string, content: string, res: Response) {
    const interview = await this.findOne(user, id);

    if (interview.status === InterviewStatus.COMPLETED) {
      throw new BadRequestException('Interview already completed');
    }

    await this.prisma.interviewMessage.create({
      data: {
        interviewId: id,
        role: MessageRole.CANDIDATE,
        content,
      },
    });

    const config = interview.config as unknown as InterviewConfig;
    let resumeContent: string | undefined;

    if (interview.resumeId) {
      const resume = await this.prisma.resume.findUnique({
        where: { id: interview.resumeId },
      });
      resumeContent = resume?.content;
    }

    const history = [
      ...interview.messages.map((m) => ({
        role:
          m.role === MessageRole.INTERVIEWER
            ? ('assistant' as const)
            : ('user' as const),
        content: m.content,
      })),
      { role: 'user' as const, content },
    ];

    const fullResponse = await this.ai.streamResponse(
      config,
      history,
      resumeContent,
      res,
    );

    await this.prisma.interviewMessage.create({
      data: {
        interviewId: id,
        role: MessageRole.INTERVIEWER,
        content: fullResponse,
      },
    });
  }

  async complete(user: User, id: string) {
    const interview = await this.findOne(user, id);

    const config = interview.config as unknown as InterviewConfig;
    const messages = interview.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const reportData = await this.ai.generateReport(config, messages);

    const report = await this.prisma.interviewReport.create({
      data: {
        interviewId: id,
        overallScore: reportData.overallScore ?? 0,
        communicationScore: reportData.communicationScore ?? 0,
        technicalScore: reportData.technicalScore ?? 0,
        confidenceScore: reportData.confidenceScore ?? 0,
        problemSolvingScore: reportData.problemSolvingScore ?? 0,
        codingScore: reportData.codingScore,
        systemDesignScore: reportData.systemDesignScore,
        behavioralScore: reportData.behavioralScore,
        strengths: reportData.strengths ?? [],
        weaknesses: reportData.weaknesses ?? [],
        knowledgeGaps: reportData.knowledgeGaps ?? [],
        topicsToRevise: reportData.topicsToRevise ?? [],
        mistakes: reportData.mistakes ?? [],
        learningRoadmap: reportData.learningRoadmap ?? [],
        readinessPercent: reportData.readinessPercent ?? 0,
        summary: reportData.summary ?? '',
      },
    });

    for (const gap of reportData.knowledgeGaps ?? []) {
      await this.prisma.userWeakArea.upsert({
        where: { userId_topic: { userId: user.id, topic: gap } },
        update: { struggleCount: { increment: 1 }, lastSeenAt: new Date() },
        create: { userId: user.id, topic: gap },
      });
    }

    const durationSecs = interview.startedAt
      ? Math.floor((Date.now() - interview.startedAt.getTime()) / 1000)
      : 0;

    await this.prisma.interview.update({
      where: { id },
      data: {
        status: InterviewStatus.COMPLETED,
        completedAt: new Date(),
        durationSecs,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        hoursPracticed: { increment: durationSecs / 3600 },
        streak: { increment: 1 },
        lastActiveAt: new Date(),
      },
    });

    return report;
  }

  async recordEvent(user: User, id: string, dto: RecordEventDto) {
    await this.findOne(user, id);
    return this.prisma.interviewEvent.create({
      data: {
        interviewId: id,
        type: dto.type as never,
        metadata: dto.metadata as never,
      },
    });
  }

  async submitCoding(user: User, id: string, dto: SubmitCodingDto) {
    await this.findOne(user, id);
    const result = this.codingService.runTests(
      dto.problemId,
      dto.code,
      dto.language,
    );
    const problem = getProblemById(dto.problemId);

    return this.prisma.codingSubmission.create({
      data: {
        interviewId: id,
        problemId: dto.problemId,
        problemTitle: problem?.title ?? dto.problemId,
        language: dto.language,
        code: dto.code,
        difficulty: problem?.difficulty ?? 'Medium',
        timeSpentSecs: dto.timeSpentSecs ?? 0,
        hintsUsed: dto.hintsUsed ?? 0,
        compileErrors: result.compileErrors,
        testsPassed: result.passed,
        testsTotal: result.total,
        testResults: result.results as never,
      },
    });
  }
}
