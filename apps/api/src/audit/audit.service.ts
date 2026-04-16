import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StoreService } from '../shared/store.service';
import { AuditLog } from '../common/interfaces/entities.interface';

export interface RecordAuditParams {
  projectId: string;
  requestId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: Record<string, unknown>;
}

export interface AuditLogQuery {
  resourceType?: string;
  resourceId?: string;
}

/**
 * 审计日志服务
 * 所有写操作（创建、更新、状态变更）必须调用此服务记录操作行为
 *
 * 替换指引：将 store.auditLogs.push 替换为 TypeORM save 到 audit_logs 表
 */
@Injectable()
export class AuditService {
  constructor(private readonly store: StoreService) {}

  /** 记录一条审计日志 */
  record(params: RecordAuditParams): AuditLog {
    const log: AuditLog = {
      id: uuidv4(),
      projectId: params.projectId,
      requestId: params.requestId,
      actorId: params.actorId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      payload: params.payload,
      createdAt: new Date(),
    };
    this.store.auditLogs.push(log);
    return log;
  }

  /** 按资源类型与 ID 查询审计记录（供 QA 与安全审查使用） */
  findByResource(resourceType: string, resourceId: string): AuditLog[] {
    return this.store.auditLogs.filter(
      (l) => l.resourceType === resourceType && l.resourceId === resourceId,
    );
  }

  findByProject(projectId: string, query: AuditLogQuery = {}): AuditLog[] {
    return this.store.auditLogs
      .filter((log) => {
        if (log.projectId !== projectId) {
          return false;
        }

        if (query.resourceType && log.resourceType !== query.resourceType) {
          return false;
        }

        if (query.resourceId && log.resourceId !== query.resourceId) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findAll(): AuditLog[] {
    return [...this.store.auditLogs].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
