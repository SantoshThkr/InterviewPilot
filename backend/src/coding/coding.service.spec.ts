import { BadRequestException } from '@nestjs/common';
import { CodingService } from './coding.service';

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

  it('does not leak hidden test inputs through getProblem', () => {
    const problem = service.getProblem('two-sum');
    const hidden = problem.testCases.filter((t) => !t.visible);
    expect(hidden.length).toBeGreaterThan(0);
    for (const t of hidden) {
      expect(t.input).toBeUndefined();
      expect(t.expected).toBeUndefined();
    }
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

  it('rejects unsupported languages gracefully', async () => {
    const result = await service.runTests('two-sum', 'print(1)', 'python');
    expect(result.passed).toBe(0);
    expect(result.results[0].error).toMatch(/not supported/i);
  });

  it('rejects empty submissions', async () => {
    await expect(
      service.runTests('two-sum', '   ', 'javascript'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
