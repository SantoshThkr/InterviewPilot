import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';

const MAX_CONTENT_CHARS = 50_000;

@Injectable()
export class ResumeService {
  private readonly logger = new Logger('ResumeService');

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  async upload(user: User, file: Express.Multer.File) {
    let text: string;
    try {
      text = await this.extractText(file);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // Corrupt or password-protected files are a client problem, not a 500.
      this.logger.warn(
        `Resume extraction failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new BadRequestException(
        'We could not read that file. Please upload a text-based PDF, DOCX, or TXT.',
      );
    }
    const content = text.slice(0, MAX_CONTENT_CHARS);
    if (!content.trim()) {
      throw new BadRequestException(
        'Could not read any text from that file. Please upload a text-based PDF, DOCX, or TXT.',
      );
    }

    const parsedData = await this.ai.analyzeResume(content);

    // Deactivate the previous active resume and store the new one atomically.
    return this.prisma.$transaction(async (tx) => {
      await tx.resume.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });
      return tx.resume.create({
        data: {
          userId: user.id,
          fileName: file.originalname,
          content,
          parsedData: parsedData as unknown as Prisma.InputJsonValue,
          isActive: true,
        },
        select: {
          id: true,
          fileName: true,
          parsedData: true,
          isActive: true,
          createdAt: true,
        },
      });
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
      select: {
        id: true,
        fileName: true,
        parsedData: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const buffer = file.buffer;
    const isPdf = buffer.subarray(0, 5).toString('latin1').startsWith('%PDF');
    // DOCX is a ZIP archive; its magic bytes are "PK".
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
    const mime = file.mimetype;

    if (isPdf || mime === 'application/pdf') {
      if (!isPdf) {
        throw new BadRequestException('File is not a valid PDF');
      }
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return result.text ?? '';
      } finally {
        await parser.destroy();
      }
    }

    if (
      isZip ||
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    return buffer.toString('utf-8');
  }
}
