import { Global, Module } from '@nestjs/common';
import { StoreService } from './store.service';

/**
 * 全局共享模块
 * @Global 使 StoreService 在整个应用内免 import 直接可注入
 */
@Global()
@Module({
  providers: [StoreService],
  exports: [StoreService],
})
export class SharedModule {}
