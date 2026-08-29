import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResumeService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  async upload(user: User, file: Express.Multer.File) {
    const content = await this.extractText(file);
    const parsedData = await this.ai.analyzeResume(content);

    await this.prisma.resume.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    });

    return this.prisma.resume.create({
      data: {
        userId: user.id,
        fileName: file.originalname,
        content,
        parsedData: parsedData as never,
        isActive: true,
      },
    });
  }

  list(user: User) {
    return this.prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        parsedData: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  getActive(user: User) {
    return this.prisma.resume.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const mime = file.mimetype;

    if (mime === 'application/pdf') {
      const pdfParse = pdfParseModule as unknown as (
        buffer: Buffer,
      ) => Promise<{ text: string }>;
      const data = await pdfParse(file.buffer);
      return data.text;
    }

    if (
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    }

    if (mime === 'text/plain') {
      return file.buffer.toString('utf-8');
    }

    return file.buffer.toString('utf-8');
  }
}
