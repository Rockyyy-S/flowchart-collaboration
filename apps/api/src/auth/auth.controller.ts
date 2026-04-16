import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { MemoryRateLimitGuard } from '../common/guards/memory-rate-limit.guard';
import { AuthService } from './auth.service';
import { IssueTokenDto } from './dto/issue-token.dto';

@Controller('auth')
export class AuthController {
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
  issueToken(@Body() dto: IssueTokenDto) {
    return this.authService.issueToken(dto.userId);
  }
}
