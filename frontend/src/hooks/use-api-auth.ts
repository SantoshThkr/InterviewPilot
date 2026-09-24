'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';

export function useApiAuth() {
  const { getToken } = useAuth();
  const { user } = useUser();

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const token = await getToken();
      if (!token) {
        throw new ApiError('Your session has expired. Please sign in again.', 401);
      }
      return apiFetch<T>(path, { ...options, token });
    },
    [getToken],
  );

  return { authFetch, user };
}
