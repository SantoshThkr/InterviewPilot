import { normalizeReport, normalizeResume } from './ai.normalize';

describe('normalizeReport', () => {
  it('returns a safe fallback for malformed JSON', () => {
    const r = normalizeReport('not json{');
    expect(r.overallScore).toBe(0);
    expect(r.strengths).toEqual([]);
    expect(r.summary).toMatch(/could not be generated/i);
  });

  it('clamps out-of-range scores into 0-100', () => {
    const r = normalizeReport(
      JSON.stringify({ overallScore: 150, technicalScore: -20 }),
    );
    expect(r.overallScore).toBe(100);
    expect(r.technicalScore).toBe(0);
  });

  it('keeps optional scores null when absent', () => {
    const r = normalizeReport(JSON.stringify({ overallScore: 70 }));
    expect(r.codingScore).toBeNull();
    expect(r.behavioralScore).toBeNull();
  });

  it('drops non-string entries from string arrays', () => {
    const r = normalizeReport(
      JSON.stringify({ strengths: ['clear', 42, null, 'structured'] }),
    );
    expect(r.strengths).toEqual(['clear', 'structured']);
  });
});

describe('normalizeResume', () => {
  it('returns empty structures for malformed JSON', () => {
    const r = normalizeResume('{bad');
    expect(r.companies).toEqual([]);
    expect(r.experienceYears).toBe(0);
  });

  it('preserves valid fields', () => {
    const r = normalizeResume(
      JSON.stringify({ companies: ['Acme'], experienceYears: 4 }),
    );
    expect(r.companies).toEqual(['Acme']);
    expect(r.experienceYears).toBe(4);
  });
});
