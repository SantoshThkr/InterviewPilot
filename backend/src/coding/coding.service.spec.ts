import { BadRequestException } from '@nestjs/common';
import { CodingService } from './coding.service';
import { CODING_PROBLEMS } from './coding.problems';

describe('CodingService', () => {
  const service = new CodingService();

  it('passes all tests for a correct two-sum solution', async () => {
    const code = `function twoSum(nums, target) {
      const seen = new Map();
      for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        if (seen.has(need)) return [seen.get(need), i];
        seen.set(nums[i], i);
      }
    }`;
    const result = await service.runTests('two-sum', code, 'javascript');
    expect(result.total).toBe(3);
    expect(result.passed).toBe(3);
    expect(result.compileErrors).toBe(0);
  });

  it('reports failing tests for a wrong solution', async () => {
    const code = `function twoSum() { return [9, 9]; }`;
    const result = await service.runTests('two-sum', code, 'javascript');
    expect(result.passed).toBe(0);
    expect(result.results.every((r) => !r.passed)).toBe(true);
  });

  it('runs real TypeScript, including generics and interfaces', async () => {
    const code = `interface Seen { [value: number]: number }
    export function twoSum(nums: number[], target: number): number[] {
      const seen = new Map<number, number>();
      for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        if (seen.has(need)) return [seen.get(need) as number, i];
        seen.set(nums[i], i);
      }
      return [];
    }`;
    const result = await service.runTests('two-sum', code, 'typescript');
    expect(result.passed).toBe(3);
  });

  it('supports class-based problems such as LRU Cache', async () => {
    const code = `class LRUCache {
      constructor(capacity) { this.capacity = capacity; this.map = new Map(); }
      get(key) {
        if (!this.map.has(key)) return -1;
        const value = this.map.get(key);
        this.map.delete(key);
        this.map.set(key, value);
        return value;
      }
      put(key, value) {
        this.map.delete(key);
        this.map.set(key, value);
        if (this.map.size > this.capacity) {
          this.map.delete(this.map.keys().next().value);
        }
      }
    }`;
    const result = await service.runTests('lru-cache', code, 'javascript');
    expect(result.total).toBeGreaterThan(0);
    expect(result.passed).toBe(result.total);
  });

  it('every catalog problem has tests and progressive hints', () => {
    for (const problem of CODING_PROBLEMS) {
      expect(problem.testCases.length).toBeGreaterThan(0);
      expect(problem.testCases.some((t) => t.visible)).toBe(true);
      expect(problem.testCases.some((t) => !t.visible)).toBe(true);
      expect(problem.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  describe('hidden tests', () => {
    it('are not exposed through getProblem', () => {
      const problem = service.getProblem('two-sum');
      const hidden = problem.testCases.filter((t) => !t.visible);
      expect(hidden.length).toBeGreaterThan(0);
      for (const t of hidden) {
        expect(t.input).toBeUndefined();
        expect(t.expected).toBeUndefined();
      }
    });

    it('do not leak inputs, expected values or outputs through a run', async () => {
      const code = `function twoSum(nums, target) { return nums; }`;
      const result = await service.runTests('two-sum', code, 'javascript');
      for (const r of result.results.filter((r) => !r.visible)) {
        expect(r).not.toHaveProperty('input');
        expect(r).not.toHaveProperty('expected');
        expect(r).not.toHaveProperty('actual');
      }
      expect(result.results.some((r) => r.visible && r.input)).toBe(true);
    });

    it('do not leak inputs through thrown error messages', async () => {
      const code = `function twoSum(nums) { throw new Error(JSON.stringify(nums)); }`;
      const result = await service.runTests('two-sum', code, 'javascript');
      const hidden = result.results.filter((r) => !r.visible);
      expect(
        hidden.every((r) => r.error === 'Runtime error on a hidden test'),
      ).toBe(true);
      expect(result.results.find((r) => r.visible)?.error).toContain(
        '[2,7,11,15]',
      );
    });
  });

  describe('sandbox isolation', () => {
    it('blocks realm escape via constructor and reports it as an error', async () => {
      const malicious = `function twoSum() {
        const C = Object['con' + 'structor'];
        return C('return typeof process')();
      }`;
      const result = await service.runTests('two-sum', malicious, 'javascript');
      expect(result.passed).toBe(0);
      expect(result.compileErrors).toBeGreaterThan(0);
      // The value 'object' (host process) must never come back as a passing result.
      expect(result.results.every((r) => r.actual !== 'object')).toBe(true);
    });

    it('has no access to require', async () => {
      const malicious = `function twoSum() { return require('fs').readdirSync('.'); }`;
      const result = await service.runTests('two-sum', malicious, 'javascript');
      expect(result.passed).toBe(0);
      expect(result.results[0].error).toBeDefined();
    });

    it('terminates an infinite loop instead of hanging', async () => {
      const code = `function twoSum() { while (true) {} }`;
      const result = await service.runTests('two-sum', code, 'javascript');
      expect(result.passed).toBe(0);
      expect(
        result.results.some((r) => /time limit|timed out/i.test(r.error ?? '')),
      ).toBe(true);
    }, 15000);
  });

  it('rejects unsupported languages instead of pretending to run them', async () => {
    await expect(
      service.runTests('two-sum', 'print(1)', 'python'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty submissions', async () => {
    await expect(
      service.runTests('two-sum', '   ', 'javascript'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
