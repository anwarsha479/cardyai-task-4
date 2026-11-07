import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError, ErrorCode, HTTP_STATUS_BY_CODE } from '../exceptions/app-error';

interface ErrorBody {
  code: ErrorCode;
  reason?: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Maps every thrown error to the shared envelope `{ error: { code, reason?, message, details? } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    response.status(HTTP_STATUS_BY_CODE[body.code]).json({ error: body });
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof AppError) {
      return {
        code: exception.code,
        reason: exception.reason,
        message: exception.message,
        details: exception.details,
      };
    }
    if (exception instanceof HttpException) {
      return { code: this.codeForStatus(exception.getStatus()), message: this.messageOf(exception) };
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return { code: ErrorCode.INTERNAL_ERROR, message: 'Something went wrong' };
  }

  private codeForStatus(status: number): ErrorCode {
    if (status === 401) return ErrorCode.UNAUTHENTICATED;
    if (status === 403) return ErrorCode.FORBIDDEN;
    if (status === 404) return ErrorCode.NOT_FOUND;
    if (status >= 500) return ErrorCode.INTERNAL_ERROR;
    return ErrorCode.VALIDATION_ERROR;
  }

  private messageOf(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === 'string') return res;
    const message = (res as { message?: unknown }).message;
    return Array.isArray(message) ? String(message[0]) : String(message ?? exception.message);
  }
}
