'use client';

import { useEffect, useState, useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApiAuth } from '@/hooks/use-api-auth';

interface Resume {
  id: string;
  fileName: string;
  parsedData?: {
    companies?: string[];
    technologies?: string[];
    suggestedQuestionTopics?: string[];
  };
  isActive: boolean;
  createdAt: string;
}

export default function ResumePage() {
  const { authFetch } = useApiAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadResumes = useCallback(() => {
    authFetch<Resume[]>('/resume')
      .then(setResumes)
      .catch((err: Error) => setError(err.message));
  }, [authFetch]);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('That file is larger than 5MB.');
      }
      const formData = new FormData();
      formData.append('file', file);
      await authFetch('/resume/upload', { method: 'POST', body: formData });
      loadResumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Allow re-uploading the same file.
      e.target.value = '';
    }
  };

  const active = resumes.find((r) => r.isActive);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold">Resume</h1>
        <p className="mb-8 text-slate-400">
          Upload your resume for personalized, resume-based interview questions.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Resume</CardTitle>
            <CardDescription>
              PDF, DOCX, or TXT — max 5MB. Your newest upload becomes the active resume used for
              interview questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-700 p-10 text-center transition-colors focus-within:border-indigo-500 hover:border-indigo-500 hover:bg-slate-900/50">
              <Upload className="mb-4 h-10 w-10 text-slate-500" />
              <p className="mb-2 font-medium">
                {uploading ? 'Reading and analyzing your resume…' : 'Click to upload'}
              </p>
              <p className="text-sm text-slate-500">AI will extract companies, projects, and tech stack</p>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="sr-only"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>

        {active?.parsedData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Active Resume Analysis</CardTitle>
              <CardDescription>{active.fileName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {active.parsedData.companies && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-slate-400">Companies</h4>
                  <div className="flex flex-wrap gap-2">
                    {active.parsedData.companies.map((c) => (
                      <span key={c} className="rounded-full bg-slate-800 px-3 py-1 text-sm">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {active.parsedData.technologies && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-slate-400">Technologies</h4>
                  <div className="flex flex-wrap gap-2">
                    {active.parsedData.technologies.map((t) => (
                      <span key={t} className="rounded-full bg-indigo-950 px-3 py-1 text-sm text-indigo-300">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {active.parsedData.suggestedQuestionTopics && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-slate-400">Suggested Interview Topics</h4>
                  <ul className="list-inside list-disc text-sm text-slate-300">
                    {active.parsedData.suggestedQuestionTopics.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Resume History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resumes.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-800 p-3">
                <FileText className="h-5 w-5 text-slate-500" />
                <div className="flex-1">
                  <p className="font-medium">{r.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                    {r.isActive && ' · Active'}
                  </p>
                </div>
              </div>
            ))}
            {resumes.length === 0 && (
              <p className="text-sm text-slate-500">No resumes uploaded yet</p>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
