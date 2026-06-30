export interface TestCase {
  input: unknown;
  expected: unknown;
  visible: boolean;
}

export interface CodingProblem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: Record<string, string>;
  testCases: TestCase[];
  functionName: string;
}

export const CODING_PROBLEMS: CodingProblem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
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
    starterCode: {
      javascript: `function twoSum(nums, target) {
  // Your code here
}`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
  // Your code here
}`,
      python: `def two_sum(nums, target):
    # Your code here
    pass`,
    },
    testCases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1], visible: true },
      { input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2], visible: true },
      { input: { nums: [3, 3], target: 6 }, expected: [0, 1], visible: false },
    ],
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    description:
      'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.',
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    constraints: ['1 <= s.length <= 10^4'],
    functionName: 'isValid',
    starterCode: {
      javascript: `function isValid(s) {
  // Your code here
}`,
      typescript: `function isValid(s: string): boolean {
  // Your code here
}`,
      python: `def is_valid(s):
    # Your code here
    pass`,
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
    starterCode: {
      javascript: `function merge(intervals) {
  // Your code here
}`,
      typescript: `function merge(intervals: number[][]): number[][] {
  // Your code here
}`,
      python: `def merge(intervals):
    # Your code here
    pass`,
    },
    testCases: [
      {
        input: { intervals: [[1, 3], [2, 6], [8, 10], [15, 18]] },
        expected: [[1, 6], [8, 10], [15, 18]],
        visible: true,
      },
      { input: { intervals: [[1, 4], [4, 5]] }, expected: [[1, 5]], visible: true },
      { input: { intervals: [[1, 4], [0, 4]] }, expected: [[0, 4]], visible: false },
    ],
  },
  {
    id: 'lru-cache',
    title: 'LRU Cache',
    difficulty: 'Hard',
    description:
      'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement the LRUCache class with get and put methods in O(1) time.',
    examples: [
      {
        input: '["LRUCache","put","put","get","put","get","get"] [[2],[1,1],[2,2],[1],[3,3],[2],[3]]',
        output: '[null,null,null,1,null,-1,3]',
      },
    ],
    constraints: ['1 <= capacity <= 3000'],
    functionName: 'LRUCache',
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
      python: `class LRUCache:
    def __init__(self, capacity):
        pass
    def get(self, key):
        pass
    def put(self, key, value):
        pass`,
    },
    testCases: [],
  },
];

export function getProblemsByDifficulty(difficulty?: string): CodingProblem[] {
  if (!difficulty) return CODING_PROBLEMS;
  return CODING_PROBLEMS.filter((p) => p.difficulty === difficulty);
}

export function getProblemById(id: string): CodingProblem | undefined {
  return CODING_PROBLEMS.find((p) => p.id === id);
}
