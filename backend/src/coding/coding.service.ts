import { Injectable, BadRequestException } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { getProblemById } from './coding.problems';

export interface TestResult {
  input: unknown;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  visible: boolean;
  error?: string;
}

export interface RunSummary {
  results: TestResult[];
  passed: number;
  total: number;
  compileErrors: number;
}

interface CaseOutcome {
  ok: boolean;
  actual?: unknown;
  error?: string;
}

const SUPPORTED_LANGUAGES = ['javascript', 'typescript'];
const PER_CASE_TIMEOUT_MS = 1000;
const MAX_CODE_LENGTH = 20_000;

/**
 * Runs candidate code inside a dedicated worker thread. Inside the worker each
 * test case executes in a fresh `vm` context created with code generation
 * disabled and no host objects in scope, so the classic realm-escape
 * (`Object.constructor('return this')()`) throws instead of reaching the host.
 * The worker has strict memory limits and is force-terminated on timeout, so a
 * memory bomb or infinite loop can only take down the worker, never the API.
 *
 * `node:vm` alone is not a security boundary; the worker isolation is what makes
 * this safe to run untrusted input.
 */
const WORKER_SOURCE = `
const vm = require('node:vm');
const { workerData, parentPort } = require('node:worker_threads');
const { functionName, code, cases } = workerData;

function runCase(input) {
  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });
  context.__ARGS_JSON__ = JSON.stringify(input);
  const argNames = Object.keys(input || {});
  const call = argNames.map((n) => '__args[' + JSON.stringify(n) + ']').join(', ');
  const src =
    '"use strict";' +
    'const console = { log(){}, error(){}, warn(){}, info(){}, debug(){} };' +
    code + '\\n;' +
    'const __args = JSON.parse(__ARGS_JSON__);' +
    'JSON.stringify(' + functionName + '(' + call + '));';
  const out = vm.runInContext(src, context, { timeout: ${PER_CASE_TIMEOUT_MS} });
  return out === undefined ? undefined : JSON.parse(out);
}

const results = (cases || []).map((c) => {
  try {
    return { ok: true, actual: runCase(c.input) };
  } catch (e) {
    const msg = e && e.message ? String(e.message).split('\\n')[0] : 'Execution error';
    return { ok: false, error: msg };
  }
});
parentPort.postMessage(results);
`;

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

  async runTests(
    problemId: string,
    code: string,
    language: string,
  ): Promise<RunSummary> {
    const problem = getProblemById(problemId);
    if (!problem) throw new BadRequestException('Problem not found');

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return {
        results: problem.testCases.map((tc) => ({
          input: tc.input,
          expected: tc.expected,
          actual: null,
          passed: false,
          visible: tc.visible,
          error: `${language} execution is not supported yet. Use JavaScript or TypeScript.`,
        })),
        passed: 0,
        total: problem.testCases.length,
        compileErrors: 0,
      };
    }

    const cleanCode = this.normalizeCode(code);
    if (!cleanCode) {
      throw new BadRequestException('No code submitted');
    }
    if (cleanCode.length > MAX_CODE_LENGTH) {
      throw new BadRequestException('Submission is too large');
    }
    if (problem.testCases.length === 0) {
      return { results: [], passed: 0, total: 0, compileErrors: 0 };
    }

    const outcomes = await this.execute(problem.functionName, cleanCode, [
      ...problem.testCases.map((tc) => ({ input: tc.input })),
    ]);

    let compileErrors = 0;
    const results: TestResult[] = problem.testCases.map((tc, i) => {
      const outcome = outcomes[i] ?? { ok: false, error: 'No result' };
      if (!outcome.ok) compileErrors++;
      return {
        input: tc.input,
        expected: tc.expected,
        actual: outcome.ok ? outcome.actual : null,
        passed:
          outcome.ok &&
          JSON.stringify(outcome.actual) === JSON.stringify(tc.expected),
        visible: tc.visible,
        error: outcome.ok ? undefined : outcome.error,
      };
    });

    return {
      results,
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      compileErrors,
    };
  }

  /** Strip `export` keywords and TypeScript type annotations so TS submissions run under plain JS. */
  private normalizeCode(code: string): string {
    return (code ?? '')
      .replace(/export\s+(default\s+)?/g, '')
      .replace(/:\s*(number|string|boolean|void|any)(\[\])?(\s*\|\s*-1)?/g, '')
      .trim();
  }

  private execute(
    functionName: string,
    code: string,
    cases: { input: unknown }[],
  ): Promise<CaseOutcome[]> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: CaseOutcome[]) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate();
        resolve(value);
      };

      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: { functionName, code, cases },
        resourceLimits: {
          maxOldGenerationSizeMb: 64,
          maxYoungGenerationSizeMb: 16,
        },
      });

      const timer = setTimeout(
        () =>
          finish(
            cases.map(() => ({ ok: false, error: 'Time limit exceeded' })),
          ),
        PER_CASE_TIMEOUT_MS * cases.length + 2_000,
      );

      worker.once('message', (msg: CaseOutcome[]) => finish(msg));
      worker.once('error', () =>
        finish(cases.map(() => ({ ok: false, error: 'Execution failed' }))),
      );
      worker.once('exit', () =>
        finish(cases.map(() => ({ ok: false, error: 'Execution stopped' }))),
      );
    });
  }
}
