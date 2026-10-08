import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResumeService } from './resume.service';

// Legacy binary .doc is not supported: the DOCX parser cannot read it.
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

@Controller('resume')
export class ResumeController {
  constructor(private resumeService: ResumeService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const isAllowed =
          allowedMimeTypes.has(file.mimetype) ||
          /\.(pdf|docx|txt)$/i.test(file.originalname);

        if (!isAllowed) {
          callback(
            new BadRequestException(
              'Unsupported file type. Upload a PDF, DOCX, or TXT file.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.resumeService.upload(user, file);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.resumeService.list(user);
  }

  @Get('active')
  getActive(@CurrentUser() user: User) {
    return this.resumeService.getActive(user);
  }
}
