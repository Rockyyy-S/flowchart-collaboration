import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 统一 API 前缀
  app.setGlobalPrefix('api/v1');

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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[Flowchart API] 已启动: http://localhost:${port}/api/v1`);
  console.log('[Flowchart API] MVP 身份模拟：请在请求头中携带 x-user-id');
}

bootstrap();
