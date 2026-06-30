import { Injectable, BadRequestException } from '@nestjs/common';
import { CodingProblem, getProblemById } from './coding.problems';

export interface TestResult {
  input: unknown;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  visible: boolean;
  error?: string;
}

@Injectable()
export class CodingService {
  getProblem(id: string) {
    const problem = getProblemById(id);
    if (!problem) throw new BadRequestException('Problem not found');
    return {
      ...problem,
      testCases: problem.testCases.map((tc) => ({
        input: tc.visible ? tc.input : undefined,
        expected: tc.visible ? tc.expected : undefined,
        visible: tc.visible,
      })),
    };
  }

  runTests(problemId: string, code: string, language: string): {
    results: TestResult[];
    passed: number;
    total: number;
    compileErrors: number;
  } {
    const problem = getProblemById(problemId);
    if (!problem) throw new BadRequestException('Problem not found');

    if (language === 'python' || language === 'java' || language === 'cpp') {
      return {
        results: problem.testCases.map((tc) => ({
          input: tc.input,
          expected: tc.expected,
          actual: null,
          passed: false,
          visible: tc.visible,
          error: `${language} execution requires external runner — use JavaScript/TypeScript for live testing`,
        })),
        passed: 0,
        total: problem.testCases.length,
        compileErrors: 0,
      };
    }

    const results: TestResult[] = [];
    let compileErrors = 0;

    for (const testCase of problem.testCases) {
      try {
        const actual = this.executeJs(problem, code, testCase.input);
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual,
          passed: JSON.stringify(actual) === JSON.stringify(testCase.expected),
          visible: testCase.visible,
        });
      } catch (err) {
        compileErrors++;
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual: null,
          passed: false,
          visible: testCase.visible,
          error: err instanceof Error ? err.message : 'Execution error',
        });
      }
    }

    return {
      results,
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      compileErrors,
    };
  }

  private executeJs(problem: CodingProblem, code: string, input: unknown): unknown {
    const cleanCode = code
      .replace(/export\s+(default\s+)?/g, '')
      .replace(/:\s*(number|string|boolean|void|any)(\[\])?(\s*\|\s*-1)?/g, '');

    const inputEntries = Object.entries(input as Record<string, unknown>);
    const args = inputEntries.map(([, v]) => JSON.stringify(v));
    const argNames = inputEntries.map(([k]) => k);

    if (problem.functionName === 'LRUCache') {
      throw new Error('LRU Cache requires class-based testing — submit for AI review');
    }

    const fn = new Function(
      `${cleanCode}; return ${problem.functionName}(${argNames.join(', ')});`,
    );

    const parsedArgs = inputEntries.map(([, v]) => v);
    return fn(...parsedArgs);
  }
}
