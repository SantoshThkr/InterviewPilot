import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../common/authenticated-request';

/**
 * Rate limits per authenticated user rather than per IP, so users behind a
 * shared NAT do not throttle each other. Runs after the global AuthGuard;
 * public routes fall back to the client IP.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const request = req as Partial<AuthenticatedRequest>;
    return Promise.resolve(
      request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`,
    );
  }
}
