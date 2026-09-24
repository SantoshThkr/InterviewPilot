import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InterviewStatus, MessageRole, Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { Response } from 'express';
import { AiService } from '../ai/ai.service';
import { InterviewConfig } from '../ai/interview.constants';
import { CodingService } from '../coding/coding.service';
import { getProblemById } from '../coding/coding.problems';
import { PrismaService } from '../prisma/prisma.service';
import { computeStreak } from './streak';
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
    const resumeContent = await this.resolveResumeContent(user, dto);

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

    // Generate the opening before creating the row, so an AI failure doesn't
    // leave a dangling interview with no first message.
    const opening = await this.ai.generateOpening(config, resumeContent);

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
        config: config as unknown as Prisma.InputJsonValue,
        status: InterviewStatus.IN_PROGRESS,
        startedAt: new Date(),
        messages: {
          create: { role: MessageRole.INTERVIEWER, content: opening },
        },
      },
    });

    return { interview, openingMessage: opening };
  }

  findAll(user: User) {
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

    const config = interview.config as unknown as InterviewConfig;
    const resumeContent = interview.resumeId
      ? (
          await this.prisma.resume.findFirst({
            where: { id: interview.resumeId, userId: user.id },
          })
        )?.content
      : undefined;

    // Build the model history in memory. Nothing is persisted until the reply
    // succeeds, so a failed turn can be retried cleanly.
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

    const reply = await this.ai.streamResponse(
      config,
      history,
      resumeContent,
      res,
    );

    if (reply === null) {
      // Generation failed; an error frame was already sent. Persist nothing.
      return;
    }

    await this.prisma.interviewMessage.createMany({
      data: [
        { interviewId: id, role: MessageRole.CANDIDATE, content },
        { interviewId: id, role: MessageRole.INTERVIEWER, content: reply },
      ],
    });
  }

  async complete(user: User, id: string) {
    const interview = await this.findOne(user, id);

    // Idempotent: completing an already-completed interview returns its report.
    if (interview.status === InterviewStatus.COMPLETED && interview.report) {
      return interview.report;
    }

    const config = interview.config as unknown as InterviewConfig;
    const messages = interview.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const reportData = await this.ai.generateReport(config, messages);

    const durationSecs = interview.startedAt
      ? Math.floor((Date.now() - interview.startedAt.getTime()) / 1000)
      : 0;

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.interviewReport.upsert({
        where: { interviewId: id },
        create: {
          interviewId: id,
          overallScore: reportData.overallScore,
          communicationScore: reportData.communicationScore,
          technicalScore: reportData.technicalScore,
          confidenceScore: reportData.confidenceScore,
          problemSolvingScore: reportData.problemSolvingScore,
          codingScore: reportData.codingScore,
          systemDesignScore: reportData.systemDesignScore,
          behavioralScore: reportData.behavioralScore,
          strengths: reportData.strengths,
          weaknesses: reportData.weaknesses,
          knowledgeGaps: reportData.knowledgeGaps,
          topicsToRevise: reportData.topicsToRevise,
          mistakes: reportData.mistakes,
          learningRoadmap: reportData.learningRoadmap,
          readinessPercent: reportData.readinessPercent,
          summary: reportData.summary,
        },
        update: {},
      });

      for (const gap of reportData.knowledgeGaps) {
        await tx.userWeakArea.upsert({
          where: { userId_topic: { userId: user.id, topic: gap } },
          update: { struggleCount: { increment: 1 }, lastSeenAt: new Date() },
          create: { userId: user.id, topic: gap },
        });
      }

      await tx.interview.update({
        where: { id },
        data: {
          status: InterviewStatus.COMPLETED,
          completedAt: new Date(),
          durationSecs,
        },
      });

      const completions = await tx.interview.findMany({
        where: {
          userId: user.id,
          status: InterviewStatus.COMPLETED,
          completedAt: { not: null },
        },
        select: { completedAt: true },
      });
      const streak = computeStreak(
        completions.map((c) => c.completedAt as Date),
      );

      await tx.user.update({
        where: { id: user.id },
        data: {
          hoursPracticed: { increment: durationSecs / 3600 },
          streak,
          lastActiveAt: new Date(),
        },
      });

      return created;
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
    const result = await this.codingService.runTests(
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
        testResults: result.results as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async resolveResumeContent(
    user: User,
    dto: CreateInterviewDto,
  ): Promise<string | undefined> {
    if (!dto.includeResume) return undefined;

    if (dto.resumeId) {
      const resume = await this.prisma.resume.findFirst({
        where: { id: dto.resumeId, userId: user.id },
      });
      return resume?.content;
    }

    const activeResume = await this.prisma.resume.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return activeResume?.content;
  }
}
