import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * 全局请求日志拦截器
 * - 记录请求入口/出口与执行耗时
 * - 统一结构化日志字段，便于接入 ELK/Loki 等日志平台
 * - 对敏感字段做脱敏，避免 token/password 泄露
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse();

    const start = Date.now();
    const requestId = request.requestId || 'unknown';
    const userId = request.user?.userId || 'anonymous';

    const startLog = {
      event: 'request.start',
      requestId,
      userId,
      method: request.method,
      path: request.originalUrl || request.url,
      query: request.query,
      body: this.redactSensitive(request.body),
    };
    this.logger.log(JSON.stringify(startLog));

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        const successLog = {
          event: 'request.success',
          requestId,
          userId,
          method: request.method,
          path: request.originalUrl || request.url,
          statusCode: response.statusCode,
          durationMs,
        };

        // 关键路径慢请求输出 WARN，普通请求输出 INFO。
        if (durationMs >= 500) {
          this.logger.warn(JSON.stringify(successLog));
          return;
        }
        this.logger.log(JSON.stringify(successLog));
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - start;
        const errorMessage =
          error instanceof Error ? error.message : 'unknown-error';
        const errorLog = {
          event: 'request.error',
          requestId,
          userId,
          method: request.method,
          path: request.originalUrl || request.url,
          durationMs,
          error: errorMessage,
        };
        this.logger.error(JSON.stringify(errorLog));
        return throwError(() => error);
      }),
    );
  }

  /**
   * 脱敏常见敏感键，避免日志中出现 token/password/secret 等信息。
   */
  private redactSensitive(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.redactSensitive(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      const normalizedKey = key.toLowerCase();
      const isSensitive =
        normalizedKey.includes('password') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('authorization');

      result[key] = isSensitive ? '[REDACTED]' : this.redactSensitive(value);
    }

    return result;
  }
}
