import { Global, Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { MemoryRateLimitGuard } from '../common/guards/memory-rate-limit.guard';

/**
 * 全局共享模块
 * @Global 使 StoreService 在整个应用内免 import 直接可注入
 */
@Global()
@Module({
  providers: [StoreService, ProjectOwnerGuard, MemoryRateLimitGuard],
  exports: [StoreService, ProjectOwnerGuard, MemoryRateLimitGuard],
})
export class SharedModule {}
