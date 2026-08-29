'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export function useApiAuth() {
  const { getToken } = useAuth();
  const { user } = useUser();

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const token = await getToken();

console.log('Clerk token exists:', Boolean(token));

if (!token) {
  throw new Error('No Clerk session token available');
}
      return apiFetch<T>(path, {
        ...options,
        token: token ?? undefined,
        userId: user?.id,
        email: user?.primaryEmailAddress?.emailAddress,
      });
    },
    [getToken, user],
  );

  return { authFetch, user };
}
