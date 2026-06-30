import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

    const token = authHeader.slice(7);

    try {
      const response = await fetch('https://api.clerk.com/v1/sessions/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get('CLERK_SECRET_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const userId = request.headers['x-clerk-user-id'] as string;
        const email = request.headers['x-clerk-user-email'] as string;

        if (userId && email && process.env.NODE_ENV === 'development') {
          request.user = await this.ensureUser(userId, email);
          return true;
        }
        throw new UnauthorizedException('Invalid token');
      }

      const session = await response.json();
      const clerkId = session.user_id;
      const userResponse = await fetch(
        `https://api.clerk.com/v1/users/${clerkId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.get('CLERK_SECRET_KEY')}`,
          },
        },
      );
      const clerkUser = await userResponse.json();
      const email =
        clerkUser.email_addresses?.[0]?.email_address ?? `${clerkId}@clerk.dev`;

      request.user = await this.ensureUser(clerkId, email, clerkUser.first_name);
      return true;
    } catch {
      const userId = request.headers['x-clerk-user-id'] as string;
      const email = request.headers['x-clerk-user-email'] as string;

      if (userId && email) {
        request.user = await this.ensureUser(userId, email);
        return true;
      }
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
