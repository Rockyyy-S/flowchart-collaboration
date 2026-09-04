import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { MemoryRateLimitGuard } from '../common/guards/memory-rate-limit.guard';
import { AuthService } from './auth.service';
import { IssueTokenDto } from './dto/issue-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('token')
  @UseGuards(MemoryRateLimitGuard)
  @RateLimit({
    keyPrefix: 'auth-token',
    limit: 30,
    windowMs: 60_000,
    identifyBy: 'ip',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '签发访问令牌和刷新令牌（开发态）' })
  @ApiBody({ type: IssueTokenDto })
  @ApiOkResponse({
    description: '签发成功',
    schema: {
      example: {
        accessToken: '***',
        refreshToken: '***',
        tokenType: 'Bearer',
        expiresIn: '1h',
      },
    },
  })
  issueToken(@Body() dto: IssueTokenDto) {
    try {
      return this.authService.issueToken(dto.userId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'auth.issue-token.failed',
          userId: dto.userId,
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  @Public()
  @Post('token/refresh')
  @UseGuards(MemoryRateLimitGuard)
  @RateLimit({
    keyPrefix: 'auth-refresh',
    limit: 60,
    windowMs: 60_000,
    identifyBy: 'ip',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '使用刷新令牌获取新的访问令牌' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: '刷新成功',
    schema: {
      example: {
        accessToken: '***',
        tokenType: 'Bearer',
        expiresIn: '1h',
      },
    },
  })
  refreshToken(@Body() dto: RefreshTokenDto) {
    try {
      return this.authService.refreshAccessToken(dto.refreshToken);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'auth.refresh-token.failed',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }
}
