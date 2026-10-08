'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';

export function useApiAuth() {
  const { getToken } = useAuth();
  const { user } = useUser();

  /** Fresh Clerk token, or an ApiError(401) if the session has expired. */
  const requireToken = useCallback(async (): Promise<string> => {
    const token = await getToken();
    if (!token) {
      throw new ApiError('Your session has expired. Please sign in again.', 401);
    }
    return token;
  }, [getToken]);

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const token = await requireToken();
      return apiFetch<T>(path, { ...options, token });
    },
    [requireToken],
  );

  return { authFetch, requireToken, user };
}
