import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  issueToken(userId: string): { accessToken: string; tokenType: 'Bearer'; expiresIn: string } {
    const payload: JwtPayload = {
      sub: userId,
      userId,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    };
  }

  verifyToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    });
  }
}
