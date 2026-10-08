import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const average = (values: number[]) =>
  values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(user: User) {
    const [interviews, weakAreas, codingSubs] = await Promise.all([
      this.prisma.interview.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          role: true,
          type: true,
          difficulty: true,
          status: true,
          createdAt: true,
          completedAt: true,
          report: {
            select: {
              overallScore: true,
              readinessPercent: true,
              behavioralScore: true,
            },
          },
        },
      }),
      this.prisma.userWeakArea.findMany({
        where: { userId: user.id, struggleCount: { gt: 0 } },
        orderBy: [{ struggleCount: 'desc' }, { lastSeenAt: 'desc' }],
        take: 10,
      }),
      this.prisma.codingSubmission.findMany({
        where: { interview: { userId: user.id } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { testsPassed: true, testsTotal: true },
      }),
    ]);

    const reports = interviews
      .filter((i) => i.report)
      .map((i) => ({ ...i, report: i.report! }));

    const averageScore = average(reports.map((i) => i.report.overallScore));
    const behavioralScores = reports
      .map((i) => i.report.behavioralScore)
      .filter((s): s is number => s !== null);
    const codingPassed = codingSubs.filter(
      (c) => c.testsTotal > 0 && c.testsPassed === c.testsTotal,
    ).length;

    return {
      // Readiness reflects the most recent completed interview.
      readinessScore: Math.round(reports[0]?.report.readinessPercent ?? 0),
      averageScore: Math.round(averageScore),
      totalInterviews: interviews.length,
      completedInterviews: reports.length,
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
      scoreHistory: reports
        .slice(0, 10)
        .map((i) => ({
          date: i.completedAt,
          score: i.report.overallScore,
          type: i.type,
        }))
        .reverse(),
      codingProgress: {
        total: codingSubs.length,
        passed: codingPassed,
        passRate:
          codingSubs.length > 0
            ? Math.round((codingPassed / codingSubs.length) * 100)
            : 0,
      },
      behavioralProgress: Math.round(average(behavioralScores)),
      practicePlan: weakAreas.slice(0, 5).map((w) => ({
        topic: w.topic,
        priority: w.struggleCount >= 3 ? 'high' : 'medium',
        suggestion:
          w.struggleCount >= 3
            ? `${w.topic} has come up as a weak area ${w.struggleCount} times — make it a focus of your next session.`
            : `Practice ${w.topic}; strong answers on it will clear it from this list.`,
      })),
    };
  }
}
