import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 全局异常过滤器
 * 统一错误响应格式：{ code, message, requestId, details }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request as any).requestId ||
      (request.headers['x-request-id'] as string) ||
      'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message: string | string[] = '服务内部错误，请稍后重试';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.statusToCode(status);
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        code = resp.code || this.statusToCode(status);
        message = resp.message || message;
        // class-validator 返回 message 数组时
        details = Array.isArray(resp.message)
          ? resp.message
          : resp.details || [];
      }
    } else if (exception instanceof Error) {
      this.logger.error(`未捕获错误: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      code,
      message: Array.isArray(message) ? '输入参数校验失败' : message,
      requestId,
      details: Array.isArray(message) ? message : details,
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
      422: 'UNPROCESSABLE_ENTITY',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return map[status] || 'ERROR';
  }
}
