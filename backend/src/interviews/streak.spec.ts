import { computeStreak } from './streak';

const at = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0);

describe('computeStreak', () => {
  const today = at(2026, 8, 24);

  it('is 0 with no completions', () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it('counts a single day practiced today', () => {
    expect(computeStreak([at(2026, 8, 24)], today)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    const dates = [at(2026, 8, 24), at(2026, 8, 23), at(2026, 8, 22)];
    expect(computeStreak(dates, today)).toBe(3);
  });

  it('still counts the streak when today has no practice yet but yesterday did', () => {
    const dates = [at(2026, 8, 23), at(2026, 8, 22)];
    expect(computeStreak(dates, today)).toBe(2);
  });

  it('breaks the streak on a gap', () => {
    const dates = [at(2026, 8, 24), at(2026, 8, 22), at(2026, 8, 21)];
    expect(computeStreak(dates, today)).toBe(1);
  });

  it('is 0 when the last practice was two days ago', () => {
    const dates = [at(2026, 8, 22), at(2026, 8, 21)];
    expect(computeStreak(dates, today)).toBe(0);
  });

  it('de-duplicates multiple completions on the same day', () => {
    const dates = [at(2026, 8, 24), at(2026, 8, 24), at(2026, 8, 23)];
    expect(computeStreak(dates, today)).toBe(2);
  });
});
