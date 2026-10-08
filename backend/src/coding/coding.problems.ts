/** Languages the sandbox can execute. TypeScript is transpiled first. */
export const SUPPORTED_LANGUAGES = ['javascript', 'typescript'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export interface TestCase {
  /**
   * Function problems: named arguments. Class problems: `{ operations,
   * arguments }` in LeetCode style, where the first operation constructs the
   * class and the expected value lists every call's return (null for void).
   */
  input: unknown;
  expected: unknown;
  visible: boolean;
}

export interface CodingProblem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  /** `function` calls `functionName(...)`; `class` drives `new functionName()`. */
  kind: 'function' | 'class';
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: Record<SupportedLanguage, string>;
  testCases: TestCase[];
  functionName: string;
  /** Progressive hints, from a gentle nudge to a near-complete approach. */
  hints: string[];
}

export const CODING_PROBLEMS: CodingProblem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    kind: 'function',
    description:
      'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume each input has exactly one solution.',
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
      },
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      'Only one valid answer exists.',
    ],
    functionName: 'twoSum',
    hints: [
      'A brute-force pair check is O(n²). Which data structure gives O(1) lookups?',
      'For each number, the value you need is target - nums[i]. Can you remember values you have already seen?',
      'Iterate once, storing value → index in a Map; before storing, check whether the complement is already in the map.',
    ],
    starterCode: {
      javascript: `function twoSum(nums, target) {
  // Your code here
}`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
  // Your code here
}`,
    },
    testCases: [
      {
        input: { nums: [2, 7, 11, 15], target: 9 },
        expected: [0, 1],
        visible: true,
      },
      {
        input: { nums: [3, 2, 4], target: 6 },
        expected: [1, 2],
        visible: true,
      },
      { input: { nums: [3, 3], target: 6 }, expected: [0, 1], visible: false },
    ],
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    kind: 'function',
    description:
      'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.',
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    constraints: ['1 <= s.length <= 10^4'],
    functionName: 'isValid',
    hints: [
      'The most recently opened bracket must be the first one closed. Which data structure models "last in, first out"?',
      'Push opening brackets onto a stack; when you see a closing bracket, it must match the top of the stack.',
      'Map each closing bracket to its opener. At the end the string is valid only if the stack is empty.',
    ],
    starterCode: {
      javascript: `function isValid(s) {
  // Your code here
}`,
      typescript: `function isValid(s: string): boolean {
  // Your code here
}`,
    },
    testCases: [
      { input: { s: '()' }, expected: true, visible: true },
      { input: { s: '()[]{}' }, expected: true, visible: true },
      { input: { s: '(]' }, expected: false, visible: false },
      { input: { s: '([{}])' }, expected: true, visible: false },
    ],
  },
  {
    id: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'Medium',
    kind: 'function',
    description:
      'Given an array of `intervals` where intervals[i] = [start_i, end_i], merge all overlapping intervals.',
    examples: [
      {
        input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]',
        output: '[[1,6],[8,10],[15,18]]',
      },
    ],
    constraints: ['1 <= intervals.length <= 10^4'],
    functionName: 'merge',
    hints: [
      'Overlaps are hard to find in arbitrary order. What ordering would put overlapping intervals next to each other?',
      'Sort by start. Then each interval either overlaps the last merged interval or starts a new one.',
      'After sorting, if current.start <= last.end, set last.end = max(last.end, current.end); otherwise push current.',
    ],
    starterCode: {
      javascript: `function merge(intervals) {
  // Your code here
}`,
      typescript: `function merge(intervals: number[][]): number[][] {
  // Your code here
}`,
    },
    testCases: [
      {
        input: {
          intervals: [
            [1, 3],
            [2, 6],
            [8, 10],
            [15, 18],
          ],
        },
        expected: [
          [1, 6],
          [8, 10],
          [15, 18],
        ],
        visible: true,
      },
      {
        input: {
          intervals: [
            [1, 4],
            [4, 5],
          ],
        },
        expected: [[1, 5]],
        visible: true,
      },
      {
        input: {
          intervals: [
            [1, 4],
            [0, 4],
          ],
        },
        expected: [[0, 4]],
        visible: false,
      },
    ],
  },
  {
    id: 'lru-cache',
    title: 'LRU Cache',
    difficulty: 'Hard',
    kind: 'class',
    description:
      'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement the LRUCache class: `constructor(capacity)`, `get(key)` returns the value or -1 if absent, and `put(key, value)` inserts or updates the key, evicting the least recently used key when the capacity is exceeded. Both operations should run in O(1) average time.',
    examples: [
      {
        input:
          '["LRUCache","put","put","get","put","get","get"] [[2],[1,1],[2,2],[1],[3,3],[2],[3]]',
        output: '[null,null,null,1,null,-1,3]',
      },
    ],
    constraints: ['1 <= capacity <= 3000'],
    functionName: 'LRUCache',
    hints: [
      'You need O(1) lookup and O(1) "move to most recent". No single basic structure does both.',
      'Combine a hash map with an ordering structure. In JavaScript, a Map preserves insertion order.',
      'On get/put, delete the key and re-insert it to mark it most recent; when over capacity, evict map.keys().next().value.',
    ],
    starterCode: {
      javascript: `class LRUCache {
  constructor(capacity) {
    // Your code here
  }
  get(key) {}
  put(key, value) {}
}`,
      typescript: `class LRUCache {
  constructor(capacity: number) {}
  get(key: number): number { return -1; }
  put(key: number, value: number): void {}
}`,
    },
    testCases: [
      {
        input: {
          operations: ['LRUCache', 'put', 'put', 'get', 'put', 'get', 'get'],
          arguments: [[2], [1, 1], [2, 2], [1], [3, 3], [2], [3]],
        },
        expected: [null, null, null, 1, null, -1, 3],
        visible: true,
      },
      {
        input: {
          operations: ['LRUCache', 'put', 'put', 'put', 'get', 'get'],
          arguments: [[2], [1, 1], [1, 10], [2, 2], [1], [2]],
        },
        expected: [null, null, null, null, 10, 2],
        visible: false,
      },
      {
        input: {
          operations: ['LRUCache', 'put', 'get', 'put', 'get', 'get'],
          arguments: [[1], [1, 1], [1], [2, 2], [1], [2]],
        },
        expected: [null, null, 1, null, -1, 2],
        visible: false,
      },
    ],
  },
];

export function getProblemById(id: string): CodingProblem | undefined {
  return CODING_PROBLEMS.find((p) => p.id === id);
}
