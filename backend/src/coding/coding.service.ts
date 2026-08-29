import { Injectable, BadRequestException } from '@nestjs/common';
import vm from 'node:vm';
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

    if (!['javascript', 'typescript'].includes(language)) {
      return {
        results: problem.testCases.map((tc) => ({
          input: tc.input,
          expected: tc.expected,
          actual: null,
          passed: false,
          visible: tc.visible,
          error: `${language} execution is not supported in this environment. Use JavaScript or TypeScript only.`,
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
    const dangerousPattern =
      /(eval\s*\(|new\s+Function\s*\(|Function\s*\(|require\s*\(|import\s*\(|process\b|global\b|window\b|document\b|fetch\s*\(|setTimeout\s*\(|setInterval\s*\(|clearTimeout\s*\(|clearInterval\s*\()/i;

    const cleanCode = code
      .replace(/export\s+(default\s+)?/g, '')
      .replace(/:\s*(number|string|boolean|void|any)(\[\])?(\s*\|\s*-1)?/g, '')
      .trim();

    if (!cleanCode || dangerousPattern.test(cleanCode)) {
      throw new Error('Unsafe code patterns are not allowed in the execution sandbox.');
    }

    const inputEntries = Object.entries(input as Record<string, unknown>);
    const argNames = inputEntries.map(([k]) => k);

    if (problem.functionName === 'LRUCache') {
      throw new Error('LRU Cache requires a custom class-based runner; submit for AI review instead.');
    }

    const sandbox = {
      console: { log: () => undefined },
      Math,
      JSON,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      Map,
      Set,
    };

    const script = new vm.Script(
      `(() => { ${cleanCode}; return ${problem.functionName}(${argNames.join(', ')}); })();`,
    );

    return script.runInNewContext(sandbox, { timeout: 250 });
  }
}
