import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  userId: string;
  tokenType: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  issueToken(userId: string): {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    refreshExpiresIn: string;
  } {
    const payload: JwtPayload = {
      sub: userId,
      userId,
      tokenType: 'access',
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        tokenType: 'refresh',
      },
      {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-refresh-secret-change-me',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    };
  }

  /**
   * 使用刷新令牌换取新的访问令牌。
   */
  refreshAccessToken(refreshToken: string): {
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
  } {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret:
          process.env.JWT_REFRESH_SECRET ||
          process.env.JWT_SECRET ||
          'dev-refresh-secret-change-me',
      });

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException({
          code: 'INVALID_REFRESH_TOKEN',
          message: '刷新令牌类型无效',
        });
      }

      const accessToken = this.jwtService.sign({
        sub: payload.userId,
        userId: payload.userId,
        tokenType: 'access',
      });

      return {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      };
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: '刷新令牌无效或已过期',
      });
    }
  }

  verifyToken(token: string): JwtPayload {
    const payload = this.jwtService.verify<JwtPayload>(token, {
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    });

    if (payload.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '令牌类型无效',
      });
    }

    return payload;
  }
}
