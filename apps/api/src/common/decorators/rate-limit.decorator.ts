import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'rate-limit-options';

export interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowMs: number;
  identifyBy?: 'ip' | 'user' | 'userOrIp';
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);