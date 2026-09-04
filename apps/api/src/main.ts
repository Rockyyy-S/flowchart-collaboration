import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { MemoryRateLimitGuard } from './common/guards/memory-rate-limit.guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // 限制请求体最大 10MB，避免超大请求压垮服务进程。
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // 统一 API 前缀
  app.setGlobalPrefix('api/v1');

  // VUL-10 修复：CORS 显式白名单（生产环境必须通过 FRONTEND_URL 指定前端域）
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // 全局参数校验（白名单模式：禁止未声明字段入库，防止 Mass Assignment 攻击）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 统一错误格式：{ code, message, requestId, details }
  app.useGlobalFilters(new HttpExceptionFilter());

  // 请求 ID 注入 + 响应包装：{ data, requestId }
  app.useGlobalInterceptors(new RequestIdInterceptor());
  // 结构化请求日志 + 执行耗时。
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  // 全局限流 + JWT 鉴权，允许 @Public() 标记的匿名端点放行。
  app.useGlobalGuards(app.get(MemoryRateLimitGuard), app.get(JwtAuthGuard));

  // Swagger/OpenAPI 文档。
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Flowchart Collaboration API')
    .setDescription('流程图协作平台后端 API 文档')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument);

  // VUL-11 修复：生产环境启用 HSTS + 安全基线响应头
  if (process.env.NODE_ENV === 'production') {
    app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '0');
      next();
    });
  }

  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DB_URL || 'memory://local-store';

  await app.listen(port);

  logger.log(`服务已启动: http://localhost:${port}/api/v1`);
  logger.log(`Swagger 文档: http://localhost:${port}/api-docs`);
  logger.log(`运行环境: ${nodeEnv}`);
  logger.log(`数据源状态: ${dbUrl.startsWith('memory://') ? '内存存储(开发模式)' : '外部数据库已配置'}`);
  logger.log('鉴权方式: Authorization: Bearer <access_token>');

  // 收到终止信号时进行优雅停机。
  const shutdown = async (signal: string) => {
    logger.warn(`收到 ${signal}，开始优雅停机...`);
    await app.close();
    logger.warn('应用已安全关闭');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

bootstrap();
