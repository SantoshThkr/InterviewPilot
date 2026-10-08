import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CodingService } from './coding.service';
import { CODING_PROBLEMS, SUPPORTED_LANGUAGES } from './coding.problems';
import { RunCodeDto } from './dto/coding.dto';

@Controller('coding')
export class CodingController {
  constructor(private codingService: CodingService) {}

  @Get('problems')
  listProblems() {
    // Never expose test cases in the list view.
    return CODING_PROBLEMS.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      languages: SUPPORTED_LANGUAGES,
    }));
  }

  @Get('problems/:id')
  getProblem(@Param('id') id: string) {
    return this.codingService.getProblem(id);
  }

  /** Practice runs outside an interview. Each run spawns a sandbox worker. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('run')
  runCode(@Body() dto: RunCodeDto) {
    return this.codingService.runTests(dto.problemId, dto.code, dto.language);
  }
}
