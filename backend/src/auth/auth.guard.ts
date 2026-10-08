import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { IS_PUBLIC_KEY } from './public.decorator';

const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

/** Registered globally: every route requires a valid Clerk token unless marked `@Public()`. */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger('AuthGuard');

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      // Misconfiguration, not a client error.
      this.logger.error('CLERK_SECRET_KEY is not configured');
      throw new UnauthorizedException('Authentication is not available');
    }

    // Only accept tokens minted for our own frontend. The localhost origin is
    // a development convenience and is not trusted in production.
    const frontendOrigin =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const authorizedParties = Array.from(
      new Set(
        isProduction
          ? [frontendOrigin]
          : [frontendOrigin, 'http://localhost:3000'],
      ),
    );

    let clerkId: string;
    try {
      const verifiedToken = await verifyToken(token, {
        secretKey,
        authorizedParties,
      });
      if (!verifiedToken?.sub) {
        throw new UnauthorizedException('Authentication failed');
      }
      clerkId = verifiedToken.sub;
    } catch (error) {
      // Log the real reason; return a generic message to the client.
      this.logger.warn(
        `Token verification failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new UnauthorizedException('Authentication failed');
    }

    request.user = await this.ensureUser(clerkId, secretKey);
    return true;
  }

  /**
   * The verified token only carries the Clerk user id (`sub`). We upsert on it
   * and only reach out to the Clerk API for profile details (email/name) when
   * the local user does not exist yet — avoiding a Clerk round-trip on every
   * request.
   */
  private async ensureUser(clerkId: string, secretKey: string) {
    const existing = await this.prisma.user.findUnique({ where: { clerkId } });
    if (existing) {
      // Avoid a write on every request; activity granularity of a few
      // minutes is plenty.
      const lastActive = existing.lastActiveAt?.getTime() ?? 0;
      if (Date.now() - lastActive < ACTIVITY_WRITE_INTERVAL_MS) return existing;
      return this.prisma.user.update({
        where: { clerkId },
        data: { lastActiveAt: new Date() },
      });
    }

    const clerkClient = createClerkClient({ secretKey });
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const email =
      clerkUser.emailAddresses?.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ??
      clerkUser.emailAddresses?.[0]?.emailAddress ??
      `${clerkId}@users.noreply.clerk.dev`;

    return this.prisma.user.upsert({
      where: { clerkId },
      update: {
        email,
        name: clerkUser.firstName ?? undefined,
        lastActiveAt: new Date(),
      },
      create: {
        clerkId,
        email,
        name: clerkUser.firstName ?? undefined,
        lastActiveAt: new Date(),
      },
    });
  }
}
