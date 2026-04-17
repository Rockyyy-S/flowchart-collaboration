import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StoreService } from '../shared/store.service';
import { AuditService } from '../audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import {
  FlowDefinition,
  NodeExecution,
  NodeConfig,
  ArtifactRequirement,
} from '../common/interfaces/entities.interface';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { UpdateFlowDraftDto } from './dto/update-flow-draft.dto';

@Injectable()
export class FlowsService {
  constructor(
    private readonly store: StoreService,
    private readonly auditService: AuditService,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * 获取当前流程定义
   * 已发布版本（最高版本号）优先；无已发布版本时返回草稿
   */
  getCurrentFlow(projectId: string): FlowDefinition {
    this.projectsService.findById(projectId);

    const published = [...this.store.flowDefinitions.values()]
      .filter(
        (f) =>
          f.projectId === projectId && f.publishStatus === 'PUBLISHED',
      )
      .sort((a, b) => b.version - a.version)[0];

    if (published) return published;

    const draft = [...this.store.flowDefinitions.values()].find(
      (f) => f.projectId === projectId && f.publishStatus === 'DRAFT',
    );

    if (!draft) {
      throw new NotFoundException({
        code: 'FLOW_NOT_FOUND',
        message: `项目 ${projectId} 暂无流程定义`,
      });
    }
    return draft;
  }

  /**
   * 更新流程草稿
   * - 更新 graphJson 与 nodesConfig
   * - 为草稿中新出现的节点自动创建 NodeExecution（READY 状态，MVP 简化）
   * - 不覆盖已存在执行实例的状态
   */
  updateDraft(
    projectId: string,
    dto: UpdateFlowDraftDto,
    actorId: string,
    requestId: string,
  ): FlowDefinition {
    this.projectsService.findById(projectId);

    let draft = [...this.store.flowDefinitions.values()].find(
      (f) => f.projectId === projectId && f.publishStatus === 'DRAFT',
    );

    if (!draft) {
      draft = {
        id: uuidv4(),
        projectId,
        version: 1,
        graphJson: {},
        nodesConfig: [],
        publishStatus: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.store.flowDefinitions.set(draft.id, draft);
    }

    const now = new Date();

    const nodesConfig: NodeConfig[] = (dto.nodesConfig || []).map((nc) => ({
      nodeId: nc.nodeId,
      name: nc.name,
      type: nc.type || 'NORMAL',
      requiredArtifacts: (nc.requiredArtifacts || []).map(
        (ar): ArtifactRequirement => ({
          id: ar.id,
          nodeId: nc.nodeId,
          name: ar.name,
          required: ar.required,
          sourceType: ar.sourceType || 'DOCUMENT',
        }),
      ),
      // 同步节点扩展配置字段
      ...(nc.assignees ? { assignees: nc.assignees } : {}),
      ...(nc.dueDate ? { dueDate: new Date(nc.dueDate) } : {}),
      ...(nc.description ? { description: nc.description } : {}),
      ...(nc.priority ? { priority: nc.priority } : {}),
      ...(nc.estimatedHours !== undefined ? { estimatedHours: nc.estimatedHours } : {}),
    }));

    draft.graphJson = dto.graphJson;
    draft.nodesConfig = nodesConfig;
    draft.updatedAt = now;
    this.store.flowDefinitions.set(draft.id, draft);

    // 为新节点自动创建 NodeExecution（已有的跳过，避免重置状态）
    const projectExecutions = [...this.store.nodeExecutions.values()].filter(
      (e) => e.flowDefinitionId === draft.id,
    );
    const executionByNodeId = new Map(projectExecutions.map((e) => [e.nodeId, e]));

    for (const nc of dto.nodesConfig || []) {
      const predecessorNodeIds = nc.predecessorNodeIds || [];
      const existing = executionByNodeId.get(nc.nodeId);

      // 从节点静态配置中取出对应的 NodeConfig，用于同步 assignees / dueDate
      const cfg = nodesConfig.find((c) => c.nodeId === nc.nodeId);

      if (!existing) {
        const execution: NodeExecution = {
          id: uuidv4(),
          projectId,
          flowDefinitionId: draft.id,
          flowVersion: draft.version,
          nodeId: nc.nodeId,
          nodeName: nc.name,
          // 仅无前置节点可直接开始；有前置时默认待解锁
          status:
            predecessorNodeIds.length === 0
              ? ExecutionStatus.READY
              : ExecutionStatus.PENDING,
          // 从 NodeConfig 同步执行人；无配置时默认空数组
          assignees: cfg?.assignees?.length ? [...cfg.assignees] : [],
          // 从 NodeConfig 同步截止时间
          ...(cfg?.dueDate ? { dueAt: cfg.dueDate } : {}),
          predecessorNodeIds,
          createdAt: now,
          updatedAt: now,
        };
        this.store.nodeExecutions.set(execution.id, execution);
        executionByNodeId.set(execution.nodeId, execution);
        continue;
      }

      // 同步节点名称与前置关系，保证后续解锁判断基于最新流程
      existing.nodeName = nc.name;
      existing.predecessorNodeIds = predecessorNodeIds;
      existing.updatedAt = now;

      // 仅当 execution 中 assignees 还是默认空值时，从 NodeConfig 同步
      if (existing.assignees.length === 0 && cfg?.assignees?.length) {
        existing.assignees = [...cfg.assignees];
      }
      // 仅当 execution 中 dueAt 未设置时，从 NodeConfig 同步
      if (!existing.dueAt && cfg?.dueDate) {
        existing.dueAt = cfg.dueDate;
      }

      // 仅对可逆的等待态进行自愈；不覆盖进行中/已完成等运行态
      if (
        existing.status === ExecutionStatus.READY ||
        existing.status === ExecutionStatus.PENDING
      ) {
        const predecessorsCompleted = predecessorNodeIds.every((predNodeId) => {
          const predExecution = executionByNodeId.get(predNodeId);
          return predExecution?.status === ExecutionStatus.COMPLETED;
        });

        existing.status =
          predecessorNodeIds.length === 0 || predecessorsCompleted
            ? ExecutionStatus.READY
            : ExecutionStatus.PENDING;
      }

      this.store.nodeExecutions.set(existing.id, existing);
    }

    this.auditService.record({
      projectId,
      requestId,
      actorId,
      action: 'UPDATE_FLOW_DRAFT',
      resourceType: 'FlowDefinition',
      resourceId: draft.id,
      payload: { projectId, nodeCount: nodesConfig.length },
    });

    return draft;
  }
}
