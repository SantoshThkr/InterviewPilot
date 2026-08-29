import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
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
      throw new UnauthorizedException('Clerk secret key is not configured');
    }

    const frontendOrigin = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const authorizedParties = Array.from(
      new Set([frontendOrigin, 'http://localhost:3000']),
    );

    try {
  const verifiedToken = await verifyToken(token, {
    secretKey,
    authorizedParties,
  });

  if (!verifiedToken?.sub) {
    throw new UnauthorizedException('Authentication failed');
  }

  const clerkId = verifiedToken.sub;

  const clerkClient = createClerkClient({ secretKey });
  const clerkUser = await clerkClient.users.getUser(clerkId);

  const email =
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    `${clerkId}@clerk.dev`;

  request.user = await this.ensureUser(
    clerkId,
    email,
    clerkUser.firstName ?? undefined,
  );

  return true;
} catch (error) {
  console.error('Clerk authentication error:', error);
  throw new UnauthorizedException('Authentication failed');
}
  }

  private async ensureUser(clerkId: string, email: string, name?: string) {
    return this.prisma.user.upsert({
      where: { clerkId },
      update: { email, name, lastActiveAt: new Date() },
      create: { clerkId, email, name, lastActiveAt: new Date() },
    });
  }
}
