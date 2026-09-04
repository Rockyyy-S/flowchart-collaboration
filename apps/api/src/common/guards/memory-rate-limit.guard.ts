import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_METADATA_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class MemoryRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, number[]>();
  private readonly defaultOptions: RateLimitOptions = {
    keyPrefix: 'global-default',
    limit: Number.parseInt(process.env.GLOBAL_RATE_LIMIT_PER_MINUTE || '120', 10),
    windowMs: 60_000,
    identifyBy: 'ip',
  };

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    const effectiveOptions = options || this.defaultOptions;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const identifier = this.resolveIdentifier(request, effectiveOptions.identifyBy);
    const bucketKey = `${effectiveOptions.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - effectiveOptions.windowMs;
    const activeHits = (this.buckets.get(bucketKey) || []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (activeHits.length >= effectiveOptions.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((activeHits[0] + effectiveOptions.windowMs - now) / 1000),
      );

      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: '请求过于频繁，请稍后重试',
          details: [`retryAfterSeconds=${retryAfterSeconds}`],
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    activeHits.push(now);
    this.buckets.set(bucketKey, activeHits);
    this.prune(now, effectiveOptions.windowMs);
    return true;
  }

  private resolveIdentifier(
    request: AuthenticatedRequest,
    strategy: RateLimitOptions['identifyBy'] = 'userOrIp',
  ): string {
    if (strategy === 'user') {
      return request.user?.userId || 'anonymous-user';
    }

    const forwarded = request.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim() ||
        request.ip ||
        request.socket.remoteAddress ||
        'unknown-ip';

    if (strategy === 'ip') {
      return ip;
    }

    return request.user?.userId || ip;
  }

  private prune(now: number, maxWindowMs: number): void {
    for (const [key, hits] of this.buckets.entries()) {
      const filteredHits = hits.filter(
        (timestamp) => now - timestamp <= maxWindowMs,
      );

      if (filteredHits.length === 0) {
        this.buckets.delete(key);
        continue;
      }

      if (filteredHits.length !== hits.length) {
        this.buckets.set(key, filteredHits);
      }
    }
  }
}