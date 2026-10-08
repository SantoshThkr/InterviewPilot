import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Authentication is enforced globally; mark the rare endpoint that must be
 * reachable without a token (e.g. the health check) with `@Public()`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
