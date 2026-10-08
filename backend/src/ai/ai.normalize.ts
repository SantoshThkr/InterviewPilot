export interface ResumeProject {
  name: string;
  description: string;
  technologies: string[];
}

export interface ResumeAnalysis {
  companies: string[];
  projects: ResumeProject[];
  technologies: string[];
  experienceYears: number;
  achievements: string[];
  careerGaps: string[];
  suggestedQuestionTopics: string[];
}

const MAX_ITEMS = 20;

/**
 * Models sometimes return objects where strings were asked for (e.g.
 * `{ "name": "Acme" }` instead of `"Acme"`). Coerce what we can and drop the
 * rest, so the UI only ever receives strings.
 */
function toText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    for (const key of ['name', 'title', 'company', 'value']) {
      if (typeof v[key] === 'string' && v[key].trim()) return v[key].trim();
    }
  }
  return null;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const text = toText(entry);
    if (text && !out.includes(text)) out.push(text.slice(0, 200));
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

function projectList(value: unknown): ResumeProject[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): ResumeProject | null => {
      if (typeof entry === 'string') {
        return { name: entry.slice(0, 200), description: '', technologies: [] };
      }
      if (!entry || typeof entry !== 'object') return null;
      const p = entry as Record<string, unknown>;
      const name = toText(p.name ?? p.title);
      if (!name) return null;
      return {
        name: name.slice(0, 200),
        description:
          typeof p.description === 'string' ? p.description.slice(0, 500) : '',
        technologies: textList(p.technologies),
      };
    })
    .filter((p): p is ResumeProject => p !== null)
    .slice(0, MAX_ITEMS);
}

/** Normalize (possibly malformed) model JSON into a resume analysis. */
export function normalizeResume(raw: string): ResumeAnalysis {
  let parsed: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }

  const years = Number(parsed.experienceYears);
  return {
    companies: textList(parsed.companies),
    projects: projectList(parsed.projects),
    technologies: textList(parsed.technologies),
    experienceYears:
      Number.isFinite(years) && years >= 0 && years < 60 ? years : 0,
    achievements: textList(parsed.achievements),
    careerGaps: textList(parsed.careerGaps),
    suggestedQuestionTopics: textList(parsed.suggestedQuestionTopics),
  };
}
