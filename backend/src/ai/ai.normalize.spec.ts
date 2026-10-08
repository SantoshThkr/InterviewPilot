import { normalizeResume } from './ai.normalize';

describe('normalizeResume', () => {
  it('returns empty structures for malformed JSON', () => {
    const r = normalizeResume('{bad');
    expect(r.companies).toEqual([]);
    expect(r.projects).toEqual([]);
    expect(r.experienceYears).toBe(0);
  });

  it('preserves valid fields', () => {
    const r = normalizeResume(
      JSON.stringify({ companies: ['Acme'], experienceYears: 4 }),
    );
    expect(r.companies).toEqual(['Acme']);
    expect(r.experienceYears).toBe(4);
  });

  it('coerces objects to strings so the UI never renders an object', () => {
    const r = normalizeResume(
      JSON.stringify({
        companies: [{ name: 'Acme', role: 'Engineer' }, 'Globex', 42, null],
        technologies: ['React', { title: 'Node.js' }, ['nested']],
      }),
    );
    expect(r.companies).toEqual(['Acme', 'Globex', '42']);
    expect(r.technologies).toEqual(['React', 'Node.js']);
  });

  it('normalizes projects and drops unnamed ones', () => {
    const r = normalizeResume(
      JSON.stringify({
        projects: [
          { name: 'Checkout', description: 'Payments', technologies: ['Go'] },
          { description: 'no name' },
          'Side project',
        ],
      }),
    );
    expect(r.projects).toEqual([
      { name: 'Checkout', description: 'Payments', technologies: ['Go'] },
      { name: 'Side project', description: '', technologies: [] },
    ]);
  });

  it('rejects implausible experience values', () => {
    expect(normalizeResume('{"experienceYears": -3}').experienceYears).toBe(0);
    expect(normalizeResume('{"experienceYears": "7"}').experienceYears).toBe(7);
  });
});
