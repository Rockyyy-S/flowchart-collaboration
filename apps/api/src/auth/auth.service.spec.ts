import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('应能签发并校验 access token', () => {
    // 使用真实 JwtService 做轻量单元测试，确保签发与校验链路闭环可用。
    const jwtService = new JwtService({
      secret: 'unit-test-secret',
      signOptions: { expiresIn: '1h' },
    });
    process.env.JWT_SECRET = 'unit-test-secret';

    const service = new AuthService(jwtService);
    const tokens = service.issueToken('user-001');

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const payload = service.verifyToken(tokens.accessToken);
    expect(payload.userId).toBe('user-001');
    expect(payload.tokenType).toBe('access');
  });
});
