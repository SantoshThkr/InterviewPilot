import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResumeService } from './resume.service';

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);

@Controller('resume')
@UseGuards(AuthGuard)
export class ResumeController {
  constructor(private resumeService: ResumeService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const isAllowed =
          allowedMimeTypes.has(file.mimetype) ||
          /\.(pdf|doc|docx|txt)$/i.test(file.originalname);

        if (!isAllowed) {
          callback(new BadRequestException('Unsupported file type. Upload PDF, DOC, DOCX, or TXT only.'), false);
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
