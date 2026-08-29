import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(user: User) {
    const interviews = await this.prisma.interview.findMany({
      where: { userId: user.id },
      include: { report: true },
      orderBy: { createdAt: 'desc' },
    });

    const completed = interviews.filter((i) => i.report);
    const avgScore =
      completed.length > 0
        ? completed.reduce((sum, i) => sum + (i.report?.overallScore ?? 0), 0) /
          completed.length
        : 0;

    const weakAreas = await this.prisma.userWeakArea.findMany({
      where: { userId: user.id },
      orderBy: { struggleCount: 'desc' },
      take: 10,
    });

    const codingSubs = await this.prisma.codingSubmission.findMany({
      where: { interview: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const recentScores = completed.slice(0, 10).map((i) => ({
      date: i.completedAt,
      score: i.report?.overallScore ?? 0,
      type: i.type,
    }));

    const readinessScore =
      completed.length > 0
        ? (completed[0].report?.readinessPercent ?? avgScore)
        : 0;

    const behavioralAvg =
      completed.filter((i) => i.report?.behavioralScore).length > 0
        ? completed.reduce((s, i) => s + (i.report?.behavioralScore ?? 0), 0) /
          completed.filter((i) => i.report?.behavioralScore).length
        : 0;

    const codingPassed = codingSubs.filter(
      (c) => c.testsPassed === c.testsTotal && c.testsTotal > 0,
    ).length;

    return {
      readinessScore: Math.round(readinessScore),
      averageScore: Math.round(avgScore),
      totalInterviews: interviews.length,
      completedInterviews: completed.length,
      streak: user.streak,
      hoursPracticed: Math.round(user.hoursPracticed * 10) / 10,
      weakTopics: weakAreas.map((w) => ({
        topic: w.topic,
        count: w.struggleCount,
      })),
      recentInterviews: interviews.slice(0, 5).map((i) => ({
        id: i.id,
        role: i.role,
        type: i.type,
        difficulty: i.difficulty,
        status: i.status,
        score: i.report?.overallScore,
        createdAt: i.createdAt,
      })),
      scoreHistory: recentScores.reverse(),
      codingProgress: {
        total: codingSubs.length,
        passed: codingPassed,
        passRate:
          codingSubs.length > 0
            ? Math.round((codingPassed / codingSubs.length) * 100)
            : 0,
      },
      behavioralProgress: Math.round(behavioralAvg),
      practicePlan: weakAreas.slice(0, 5).map((w) => ({
        topic: w.topic,
        priority: w.struggleCount > 3 ? 'high' : 'medium',
        suggestion: `Practice ${w.topic} questions at ${w.struggleCount > 3 ? 'Advanced' : 'Intermediate'} difficulty`,
      })),
    };
  }
}
