import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // 全局 JWT 鉴权，允许 @Public() 标记的匿名端点放行
  app.useGlobalGuards(app.get(JwtAuthGuard));

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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[Flowchart API] 已启动: http://localhost:${port}/api/v1`);
  console.log('[Flowchart API] 鉴权方式：Authorization: Bearer <token>');
}

bootstrap();
