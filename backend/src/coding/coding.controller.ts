import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CodingService } from './coding.service';
import { CODING_PROBLEMS } from './coding.problems';
import { AuthGuard } from '../auth/auth.guard';

@Controller('coding')
@UseGuards(AuthGuard)
export class CodingController {
  constructor(private codingService: CodingService) {}

  @Get('problems')
  listProblems() {
    return CODING_PROBLEMS.map(({ testCases, starterCode, ...p }) => ({
      ...p,
      languages: Object.keys(starterCode),
    }));
  }

  @Get('problems/:id')
  getProblem(@Param('id') id: string) {
    return this.codingService.getProblem(id);
  }

  @Post('run')
  runCode(
    @Body() body: { problemId: string; code: string; language: string },
  ) {
    return this.codingService.runTests(body.problemId, body.code, body.language);
  }
}
