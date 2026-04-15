import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProjectsModule } from './projects/projects.module';
import { FlowsModule } from './flows/flows.module';
import { DocumentsModule } from './documents/documents.module';
import { ExecutionsModule } from './executions/executions.module';

@Module({
  imports: [
    SharedModule,        // 全局内存存储（@Global，隐式提供 StoreService）
    AuditModule,         // 审计日志服务
    NotificationsModule, // 通知占位服务
    ProjectsModule,      // POST /projects
    FlowsModule,         // GET/PUT /projects/:id/flows/*
    DocumentsModule,     // POST/GET /projects/:id/documents
    ExecutionsModule,    // GET /projects/:id/executions + /executions/* 动作接口
  ],
})
export class AppModule {}
