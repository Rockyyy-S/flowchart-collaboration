import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StoreService } from '../shared/store.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Project,
  FlowDefinition,
} from '../common/interfaces/entities.interface';
import { generateId } from '../common/utils/generate-id.util';
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
   * 1. 验证团队存在
   * 2. 创建 Project 主聚合根，绑定 teamId
   * 3. 创建默认 FlowDefinition（DRAFT, version=1，空图结构）
   * 4. 注册创建者为 OWNER，注册额外成员
   * 5. 写审计日志 + 发送通知占位
   */
  create(
    dto: CreateProjectDto,
    actorId: string,
    requestId: string,
  ): { project: Project; flowDefinition: FlowDefinition } {
    // 验证团队存在（不验证成员关系，由业务规则保障）
    const team = this.store.teams.get(dto.teamId);
    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `团队 ${dto.teamId} 不存在`,
      });
    }

    const projectId = generateId('project-');
    const workspaceId = uuidv4();
    const now = new Date();

    const project: Project = {
      id: projectId,
      name: dto.name,
      description: dto.description,
      ownerId: actorId,
      status: 'ACTIVE',
      workspaceId,
      teamId: dto.teamId,
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

  /**
   * 查询用户参与的所有项目列表
   * 策略：
   * 1. 找出该用户所在的所有团队
   * 2. 找出绑定这些团队的所有项目
   * 3. 同时保留通过 projectMembers 直接加入的项目（兼容历史数据）
   * 4. 附带用户在项目中的角色和节点执行进度摘要
   */
  findByUser(userId: string): Array<{
    projectId: string;
    name: string;
    description?: string;
    status: string;
    teamId: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    progress: {
      totalNodes: number;
      completedNodes: number;
      inProgressNodes: number;
    };
  }> {
    // 收集用户所在团队绑定的项目 ID
    const teamProjectIds = new Set<string>();
    for (const team of this.store.teams.values()) {
      if (team.memberIds.includes(userId)) {
        for (const project of this.store.projects.values()) {
          if (project.teamId === team.id) {
            teamProjectIds.add(project.id);
          }
        }
      }
    }

    // 也收集通过 projectMembers 直接加入的项目（兼容旧数据/直接邀请场景）
    const memberEntries: Map<string, string> = new Map(); // projectId -> role
    for (const member of this.store.projectMembers.values()) {
      if (member.userId === userId) {
        memberEntries.set(member.projectId, member.role);
        teamProjectIds.add(member.projectId);
      }
    }

    // 组装每个项目的详情与执行进度
    const result = [];
    for (const projectId of teamProjectIds) {
      const project = this.store.projects.get(projectId);
      if (!project) continue; // 防御性跳过：项目可能已被删除

      // 确定用户角色：OWNER > 已有成员记录 > MEMBER（通过团队加入）
      let role = 'MEMBER';
      if (project.ownerId === userId) {
        role = 'OWNER';
      } else if (memberEntries.has(projectId)) {
        role = memberEntries.get(projectId) as string;
      }

      // 计算该项目的节点执行进度
      let totalNodes = 0;
      let completedNodes = 0;
      let inProgressNodes = 0;
      for (const exec of this.store.nodeExecutions.values()) {
        if (exec.projectId === projectId) {
          totalNodes++;
          if (exec.status === 'COMPLETED') {
            completedNodes++;
          } else if (
            exec.status === 'IN_PROGRESS' ||
            exec.status === 'GATE_CHECKING'
          ) {
            inProgressNodes++;
          }
        }
      }

      result.push({
        projectId: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        teamId: project.teamId,
        role,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        progress: {
          totalNodes,
          completedNodes,
          inProgressNodes,
        },
      });
    }

    return result;
  }

  /**
   * 删除项目（仅创建者/OWNER 可操作）
   * 级联删除：
   * - 该项目下所有 NodeExecution
   * - 该项目下所有 FlowDefinition
   * - 该项目下所有 Flowchart（包含子流程图）
   * - 该项目下所有 ProjectMember
   * - 该项目下所有 ArtifactBinding
   * - 该项目下所有 Document
   * - 最后删除 Project 本身
   * - 写审计日志
   */
  deleteProject(
    projectId: string,
    actorId: string,
    requestId: string,
  ): void {
    const project = this.findById(projectId);

    // 权限校验：仅 OWNER 可删除
    if (project.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'PROJECT_OWNER_REQUIRED',
        message: '仅项目创建者可删除项目',
      });
    }

    // 级联删除 NodeExecution
    for (const [id, exec] of this.store.nodeExecutions) {
      if (exec.projectId === projectId) {
        this.store.nodeExecutions.delete(id);
      }
    }

    // 级联删除 FlowDefinition
    for (const [id, flowDef] of this.store.flowDefinitions) {
      if (flowDef.projectId === projectId) {
        this.store.flowDefinitions.delete(id);
      }
    }

    // 级联删除 Flowchart（含子流程图，因为子流程图的 projectId 与父相同）
    for (const [id, flowchart] of this.store.flowcharts) {
      if (flowchart.projectId === projectId) {
        this.store.flowcharts.delete(id);
      }
    }

    // 级联删除 ArtifactBinding
    for (const [id, binding] of this.store.artifactBindings) {
      // ArtifactBinding 没有 projectId，通过关联的 NodeExecution 间接判断
      // 此时 nodeExecutions 已被清除，binding 成为孤立记录，一并清除
      const execExists = this.store.nodeExecutions.has(binding.nodeExecutionId);
      if (!execExists) {
        this.store.artifactBindings.delete(id);
      }
    }

    // 级联删除 Document
    for (const [id, doc] of this.store.documents) {
      if (doc.projectId === projectId) {
        this.store.documents.delete(id);
      }
    }

    // 级联删除 ProjectMember
    for (const [id, member] of this.store.projectMembers) {
      if (member.projectId === projectId) {
        this.store.projectMembers.delete(id);
      }
    }

    // 删除项目本身
    this.store.projects.delete(projectId);

    this.auditService.record({
      projectId,
      requestId,
      actorId,
      action: 'DELETE_PROJECT',
      resourceType: 'Project',
      resourceId: projectId,
      payload: { name: project.name, teamId: project.teamId },
    });
  }
}
