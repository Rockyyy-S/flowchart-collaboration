import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

/**
 * 请求 ID 注入拦截器
 * - 若请求头携带 X-Request-Id 则复用，否则生成新 UUID
 * - 在响应头回写 X-Request-Id
 * - 将业务数据包装为 { data, requestId } 格式
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const requestId =
      (request.headers['x-request-id'] as string) || uuidv4();
    // 挂载到 request 对象，供 Filter 和 Service 读取
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    // 健康检查用于探针约定，保持返回体为 { status: 'ok' }，不做 data 包装。
    if (
      request.originalUrl === '/api/v1/health' ||
      request.url === '/api/v1/health'
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        data,
        requestId,
      })),
    );
  }
}
