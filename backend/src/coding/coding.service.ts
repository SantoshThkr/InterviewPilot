import { Injectable, BadRequestException } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import ts from 'typescript';
import {
  SUPPORTED_LANGUAGES,
  getProblemById,
  type CodingProblem,
} from './coding.problems';

export interface TestResult {
  /** Omitted for hidden tests. */
  input?: unknown;
  expected?: unknown;
  actual?: unknown;
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

const PER_CASE_TIMEOUT_MS = 1000;
const MAX_CODE_LENGTH = 20_000;
const TIME_LIMIT_ERROR = 'Time limit exceeded';
/** Runner-generated messages that are safe to show for hidden tests. */
const GENERIC_ERRORS = new Set([
  TIME_LIMIT_ERROR,
  'Execution failed',
  'Execution stopped',
  'No result',
]);

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
const { functionName, kind, code, cases } = workerData;

function harness(input) {
  if (kind === 'class') {
    return 'const __ops = __args.operations, __params = __args.arguments;' +
      'const __obj = new ' + functionName + '(...__params[0]);' +
      'const __out = [null];' +
      'for (let i = 1; i < __ops.length; i++) {' +
      '  const r = __obj[__ops[i]](...__params[i]);' +
      '  __out.push(r === undefined ? null : r);' +
      '}' +
      'JSON.stringify(__out);';
  }
  const argNames = Object.keys(input || {});
  const call = argNames.map((n) => '__args[' + JSON.stringify(n) + ']').join(', ');
  return 'JSON.stringify(' + functionName + '(' + call + '));';
}

function runCase(input) {
  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });
  context.__ARGS_JSON__ = JSON.stringify(input);
  const src =
    '"use strict";' +
    'const console = { log(){}, error(){}, warn(){}, info(){}, debug(){} };' +
    code + '\\n;' +
    'const __args = JSON.parse(__ARGS_JSON__);' +
    harness(input);
  const out = vm.runInContext(src, context, { timeout: ${PER_CASE_TIMEOUT_MS} });
  return out === undefined ? undefined : JSON.parse(out);
}

const results = (cases || []).map((c) => {
  try {
    return { ok: true, actual: runCase(c.input) };
  } catch (e) {
    const msg = e && e.message ? String(e.message).split('\\n')[0] : 'Execution error';
    return { ok: false, error: msg.slice(0, 300) };
  }
});
parentPort.postMessage(results);
`;

/**
 * Hidden tests must not reveal their inputs, expected values, or anything the
 * candidate's code could use to exfiltrate them (its return value or a thrown
 * message built from the input).
 */
export function redactHiddenResults(results: unknown): unknown {
  if (!Array.isArray(results)) return results;
  return results.map((r: TestResult) =>
    r && r.visible === false
      ? {
          passed: r.passed,
          visible: false,
          ...(r.error
            ? {
                error: GENERIC_ERRORS.has(r.error)
                  ? r.error
                  : 'Runtime error on a hidden test',
              }
            : {}),
        }
      : r,
  );
}

@Injectable()
export class CodingService {
  getProblem(id: string) {
    const problem = getProblemById(id);
    if (!problem) throw new BadRequestException('Problem not found');
    return {
      ...problem,
      languages: SUPPORTED_LANGUAGES,
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
    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
      throw new BadRequestException(
        `${language} is not supported. Use JavaScript or TypeScript.`,
      );
    }

    const source = stripExports(code ?? '');
    if (!source) throw new BadRequestException('No code submitted');
    if (source.length > MAX_CODE_LENGTH) {
      throw new BadRequestException('Submission is too large');
    }
    if (problem.testCases.length === 0) {
      return { results: [], passed: 0, total: 0, compileErrors: 0 };
    }

    const compiled = language === 'typescript' ? transpile(source) : source;
    const outcomes = await this.execute(problem, compiled);

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
      results: redactHiddenResults(results) as TestResult[],
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      compileErrors,
    };
  }

  private execute(
    problem: CodingProblem,
    code: string,
  ): Promise<CaseOutcome[]> {
    const cases = problem.testCases.map((tc) => ({ input: tc.input }));
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
        workerData: {
          functionName: problem.functionName,
          kind: problem.kind,
          code,
          cases,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 64,
          maxYoungGenerationSizeMb: 16,
        },
      });

      const timer = setTimeout(
        () => finish(cases.map(() => ({ ok: false, error: TIME_LIMIT_ERROR }))),
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

/** Submissions run as a plain script, so module syntax is dropped. */
function stripExports(code: string): string {
  return code.replace(/\bexport\s+(default\s+)?/g, '').trim();
}

/**
 * Type-strips TypeScript with the real compiler (no type checking), so
 * generics, interfaces and type assertions work as candidates expect.
 */
function transpile(source: string): string {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
    },
    reportDiagnostics: false,
  }).outputText;
}
