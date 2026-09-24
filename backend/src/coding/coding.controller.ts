import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CodingService } from './coding.service';
import { CODING_PROBLEMS } from './coding.problems';
import { AuthGuard } from '../auth/auth.guard';
import { RunCodeDto } from './dto/coding.dto';

@Controller('coding')
@UseGuards(AuthGuard)
export class CodingController {
  constructor(private codingService: CodingService) {}

  @Get('problems')
  listProblems() {
    // Never expose testCases (hidden tests) or starterCode bodies in the list view.
    return CODING_PROBLEMS.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      description: p.description,
      examples: p.examples,
      constraints: p.constraints,
      functionName: p.functionName,
      languages: Object.keys(p.starterCode),
    }));
  }

  @Get('problems/:id')
  getProblem(@Param('id') id: string) {
    return this.codingService.getProblem(id);
  }

  @Post('run')
  runCode(@Body() dto: RunCodeDto) {
    return this.codingService.runTests(dto.problemId, dto.code, dto.language);
  }
}
