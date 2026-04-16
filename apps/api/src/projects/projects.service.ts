import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StoreService } from '../shared/store.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Project,
  FlowDefinition,
} from '../common/interfaces/entities.interface';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly store: StoreService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 创建项目（原子动作）
   * 1. 创建 Project 主聚合根
   * 2. 创建默认 FlowDefinition（DRAFT, version=1，空图结构）
   * 3. 注册创建者为 OWNER，注册额外成员
   * 4. 写审计日志 + 发送通知占位
   */
  create(
    dto: CreateProjectDto,
    actorId: string,
    requestId: string,
  ): { project: Project; flowDefinition: FlowDefinition } {
    const projectId = uuidv4();
    const workspaceId = uuidv4();
    const now = new Date();

    const project: Project = {
      id: projectId,
      name: dto.name,
      description: dto.description,
      ownerId: actorId,
      status: 'ACTIVE',
      workspaceId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.projects.set(projectId, project);

    // 默认流程草稿（空白图，等待用户编辑）
    const flowDef: FlowDefinition = {
      id: uuidv4(),
      projectId,
      version: 1,
      graphJson: { nodes: [], edges: [] },
      nodesConfig: [],
      publishStatus: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };
    this.store.flowDefinitions.set(flowDef.id, flowDef);

    // 注册创建者为 OWNER
    this.store.projectMembers.set(uuidv4(), {
      id: uuidv4(),
      projectId,
      userId: actorId,
      role: 'OWNER',
      joinedAt: now,
    });

    // 注册额外成员
    if (dto.members) {
      for (const m of dto.members) {
        this.store.projectMembers.set(uuidv4(), {
          id: uuidv4(),
          projectId,
          userId: m.userId,
          role: m.role,
          joinedAt: now,
        });
      }
    }

    this.auditService.record({
      projectId,
      requestId,
      actorId,
      action: 'CREATE_PROJECT',
      resourceType: 'Project',
      resourceId: projectId,
      payload: { name: dto.name, memberCount: (dto.members?.length ?? 0) + 1 },
    });

    this.notificationsService.publishEvent({
      eventType: 'PROJECT_CREATED',
      receivers: [actorId],
      payload: { projectId, projectName: dto.name },
    });

    return { project, flowDefinition: flowDef };
  }

  findById(projectId: string): Project {
    const project = this.store.projects.get(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: `项目 ${projectId} 不存在`,
      });
    }
    return project;
  }
}
