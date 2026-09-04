import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * 健康检查端点，供容器探针和负载均衡器探活使用。
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '健康检查' })
  @ApiOkResponse({
    description: '服务可用',
    schema: {
      example: {
        status: 'ok',
      },
    },
  })
  health() {
    return { status: 'ok' };
  }
}
