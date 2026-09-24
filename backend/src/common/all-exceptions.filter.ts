import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Converts every thrown error into a consistent, client-safe JSON body.
 * Internal details (stack traces, Prisma/OpenAI internals) are logged but
 * never sent to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} -> ${status}: ${message}`);
    }

    // The stream handler may have already sent headers (SSE). Don't double-send.
    if (res.headersSent) {
      res.end();
      return;
    }

    res.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }

  private resolve(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ??
            exception.message);
      return {
        status: exception.getStatus(),
        message: Array.isArray(message) ? message.join(', ') : message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
      }
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          message: 'Resource already exists',
        };
      }
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request' };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong. Please try again.',
    };
  }
}
