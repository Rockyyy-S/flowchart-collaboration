import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StoreService } from '../shared/store.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GateEngineService } from './gate-engine.service';
import {
  NodeExecution,
  ArtifactBinding,
  GateResult,
} from '../common/interfaces/entities.interface';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { StartExecutionDto } from './dto/start-execution.dto';
import { SubmitExecutionDto } from './dto/submit-execution.dto';
import { BindArtifactDto } from './dto/bind-artifact.dto';

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly store: StoreService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly gateEngine: GateEngineService,
  ) {}

  /** 查询项目下所有节点执行实例（可按状态过滤） */
  findByProject(projectId: string, statusFilter?: string): NodeExecution[] {
    let executions = [...this.store.nodeExecutions.values()].filter(
      (e) => e.projectId === projectId,
    );

    // 查询前自愈 READY/PENDING，兼容历史数据或流程变更后的状态漂移
    this.reconcileProjectExecutionStatuses(projectId, executions);

    if (statusFilter) {
      executions = executions.filter(
        (e) => e.status === statusFilter.toUpperCase(),
      );
    }
    return executions;
  }

  /** 按 ID 查找执行实例 */
  findById(executionId: string): NodeExecution {
    const execution = this.store.nodeExecutions.get(executionId);
    if (!execution) {
      throw new NotFoundException({
        code: 'EXECUTION_NOT_FOUND',
        message: `执行实例 ${executionId} 不存在`,
      });
    }
    return execution;
  }

  /**
   * 开始节点执行
   * 合法来源状态：READY | NEEDS_FIX → IN_PROGRESS
   * 状态机约束：禁止 PENDING 直接跳转到 IN_PROGRESS
   */
  start(
    executionId: string,
    dto: StartExecutionDto,
    actorId: string,
    requestId: string,
  ): NodeExecution {
    const execution = this.findById(executionId);
    const previousStatus = execution.status;

    if (
      previousStatus !== ExecutionStatus.READY &&
      previousStatus !== ExecutionStatus.NEEDS_FIX
    ) {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: `当前状态（${previousStatus}）不允许执行开始操作，需为 READY 或 NEEDS_FIX`,
      });
    }

    // READY 节点必须满足前置全部完成；并行节点天然满足（共享同一前置即可同时 READY）
    if (previousStatus === ExecutionStatus.READY) {
      const projectExecutions = [...this.store.nodeExecutions.values()].filter(
        (e) => e.projectId === execution.projectId,
      );
      const predecessorsCompleted = execution.predecessorNodeIds.every(
        (predNodeId) =>
          projectExecutions.some(
            (e) =>
              e.nodeId === predNodeId && e.status === ExecutionStatus.COMPLETED,
          ),
      );

      if (!predecessorsCompleted) {
        execution.status = ExecutionStatus.PENDING;
        execution.updatedAt = new Date();
        this.store.nodeExecutions.set(executionId, execution);

        throw new BadRequestException({
          code: 'PREDECESSOR_NOT_COMPLETED',
          message: '前置节点未全部完成，当前节点不可开始',
        });
      }
    }

    const now = new Date();
    execution.status = ExecutionStatus.IN_PROGRESS;
    execution.startedAt = execution.startedAt || now;
    execution.updatedAt = now;
    this.store.nodeExecutions.set(executionId, execution);

    this.auditService.record({
      projectId: execution.projectId,
      requestId,
      actorId,
      action: 'START_EXECUTION',
      resourceType: 'NodeExecution',
      resourceId: executionId,
      payload: { previousStatus, nodeId: execution.nodeId },
    });

    return execution;
  }

  /**
   * 提交节点完成并触发门禁校验（原子操作）
   * 来源状态：IN_PROGRESS
   * 门禁通过 → COMPLETED；门禁失败 → NEEDS_FIX
   */
  submit(
    executionId: string,
    dto: SubmitExecutionDto,
    actorId: string,
    requestId: string,
  ): NodeExecution {
    const execution = this.findById(executionId);

    if (execution.status !== ExecutionStatus.IN_PROGRESS) {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: `当前状态（${execution.status}）不允许提交，需为 IN_PROGRESS`,
      });
    }

    const now = new Date();
    const executionBeforeCommit = this.cloneExecution(execution);
    const projectExecutions = [...this.store.nodeExecutions.values()]
      .filter((item) => item.projectId === execution.projectId)
      .map((item) => this.cloneExecution(item));

    const stagedExecution = this.cloneExecution(execution);
    stagedExecution.status = ExecutionStatus.GATE_CHECKING;
    stagedExecution.updatedAt = now;

    const gateResult = this.gateEngine.check(stagedExecution);
    stagedExecution.gateResult = gateResult;

    const successorUpdates = gateResult.pass
      ? this.planSuccessorUnlocks(projectExecutions, stagedExecution, now)
      : [];

    if (gateResult.pass) {
      stagedExecution.status = ExecutionStatus.COMPLETED;
      stagedExecution.completedAt = now;
    } else {
      stagedExecution.status = ExecutionStatus.NEEDS_FIX;
    }
    stagedExecution.updatedAt = now;

    const notificationEvent = gateResult.pass
      ? {
          eventType: 'NODE_COMPLETED',
          receivers: [actorId],
          payload: {
            executionId,
            nodeId: stagedExecution.nodeId,
            projectId: stagedExecution.projectId,
          },
        }
      : {
          eventType: 'GATE_CHECK_FAILED',
          receivers: [actorId],
          payload: {
            executionId,
            nodeId: stagedExecution.nodeId,
            missingArtifacts: gateResult.missingArtifacts,
          },
        };

    const successorSnapshots = successorUpdates
      .map((item) => this.store.nodeExecutions.get(item.id))
      .filter((item): item is NodeExecution => !!item)
      .map((item) => this.cloneExecution(item));
    const auditLogCount = this.store.auditLogs.length;
    const notificationTaskCount = this.store.notificationTasks.length;

    try {
      this.store.nodeExecutions.set(executionId, stagedExecution);
      for (const successor of successorUpdates) {
        this.store.nodeExecutions.set(successor.id, successor);
      }

      this.notificationsService.publishEvent(notificationEvent);

      this.auditService.record({
        projectId: stagedExecution.projectId,
        requestId,
        actorId,
        action: 'SUBMIT_EXECUTION',
        resourceType: 'NodeExecution',
        resourceId: executionId,
        payload: {
          nodeId: stagedExecution.nodeId,
          gatePass: gateResult.pass,
          missingCount: gateResult.missingArtifacts.length,
          comment: dto.comment,
        },
      });
    } catch (error) {
      this.store.nodeExecutions.set(executionId, executionBeforeCommit);
      for (const snapshot of successorSnapshots) {
        this.store.nodeExecutions.set(snapshot.id, snapshot);
      }
      this.store.notificationTasks.splice(notificationTaskCount);
      this.store.auditLogs.splice(auditLogCount);
      throw error;
    }

    return stagedExecution;
  }

  /** 查询门禁结果（需已进入 GATE_CHECKING / COMPLETED / NEEDS_FIX 状态） */
  getGateResult(executionId: string) {
    const execution = this.findById(executionId);

    const validStatuses: ExecutionStatus[] = [
      ExecutionStatus.COMPLETED,
      ExecutionStatus.NEEDS_FIX,
      ExecutionStatus.GATE_CHECKING,
    ];

    if (!validStatuses.includes(execution.status)) {
      throw new BadRequestException({
        code: 'GATE_RESULT_UNAVAILABLE',
        message: `执行实例尚未进入门禁检查阶段（当前状态：${execution.status}）`,
      });
    }

    const gateResult = execution.gateResult || {
      pass: false,
      checkedAt: new Date(),
      missingArtifacts: [],
    };

    return {
      executionId,
      status: execution.status,
      pass: gateResult.pass,
      checkedAt: gateResult.checkedAt,
      missingArtifacts: gateResult.missingArtifacts,
    };
  }

  /**
   * 绑定输出物
   * - documentId 计入门禁，externalUrl 仅供参考（架构约束）
   * - 同一 requirementId 重复绑定时覆盖旧记录
   */
  bindArtifact(
    executionId: string,
    dto: BindArtifactDto,
    actorId: string,
    requestId: string,
  ): ArtifactBinding {
    const execution = this.findById(executionId);

    if (!dto.documentId && !dto.externalUrl) {
      throw new BadRequestException({
        code: 'BINDING_TARGET_REQUIRED',
        message: 'documentId 与 externalUrl 必须填写至少一项',
      });
    }

    // 验证平台内文档存在
    if (dto.documentId && !this.store.documents.has(dto.documentId)) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: `文档 ${dto.documentId} 不存在，请先上传文档后再绑定`,
      });
    }

    // 同一 requirementId 重复绑定时覆盖（幂等设计）
    const existing = [...this.store.artifactBindings.values()].find(
      (b) =>
        b.nodeExecutionId === executionId &&
        b.requirementId === dto.requirementId,
    );

    const now = new Date();
    const binding: ArtifactBinding = {
      id: existing?.id || uuidv4(),
      nodeExecutionId: executionId,
      requirementId: dto.requirementId,
      documentId: dto.documentId,
      externalUrl: dto.externalUrl,
      boundAt: now,
      boundBy: actorId,
    };
    this.store.artifactBindings.set(binding.id, binding);

    this.auditService.record({
      projectId: execution.projectId,
      requestId,
      actorId,
      action: existing ? 'UPDATE_ARTIFACT_BINDING' : 'CREATE_ARTIFACT_BINDING',
      resourceType: 'ArtifactBinding',
      resourceId: binding.id,
      payload: {
        executionId,
        nodeId: execution.nodeId,
        requirementId: dto.requirementId,
        documentId: dto.documentId,
        externalUrl: dto.externalUrl,
      },
    });

    return binding;
  }

  /**
   * 节点完成后自动解锁后继节点（PENDING → READY）
   * 检查 predecessorNodeIds 是否全部 COMPLETED
   */
  private planSuccessorUnlocks(
    projectExecutions: NodeExecution[],
    gateCheckingExecution: NodeExecution,
    now: Date,
  ): NodeExecution[] {
    const executionByNodeId = new Map(
      projectExecutions.map((item) => [item.nodeId, this.cloneExecution(item)]),
    );

    const completedExecution = this.cloneExecution(gateCheckingExecution);
    completedExecution.status = ExecutionStatus.COMPLETED;
    completedExecution.completedAt = now;
    completedExecution.updatedAt = now;
    executionByNodeId.set(completedExecution.nodeId, completedExecution);

    const updates: NodeExecution[] = [];
    const candidates = [...executionByNodeId.values()].filter((item) =>
      item.predecessorNodeIds.includes(completedExecution.nodeId),
    );

    for (const candidate of candidates) {
      if (candidate.status !== ExecutionStatus.PENDING) {
        continue;
      }

      const allPredecessorsCompleted = candidate.predecessorNodeIds.every(
        (predNodeId) =>
          executionByNodeId.get(predNodeId)?.status === ExecutionStatus.COMPLETED,
      );

      if (!allPredecessorsCompleted) {
        continue;
      }

      const unlockedExecution = this.cloneExecution(candidate);
      unlockedExecution.status = ExecutionStatus.READY;
      unlockedExecution.updatedAt = now;
      executionByNodeId.set(unlockedExecution.nodeId, unlockedExecution);
      updates.push(unlockedExecution);
    }

    return updates;
  }

  /**
   * 将项目下节点执行状态与前置完成关系对齐，仅修正 READY/PENDING 两类等待态
   */
  private reconcileProjectExecutionStatuses(
    projectId: string,
    projectExecutions?: NodeExecution[],
  ): void {
    const executions =
      projectExecutions ??
      [...this.store.nodeExecutions.values()].filter((e) => e.projectId === projectId);

    if (executions.length === 0) return;

    const executionByNodeId = new Map(executions.map((e) => [e.nodeId, e]));

    for (const execution of executions) {
      if (
        execution.status !== ExecutionStatus.READY &&
        execution.status !== ExecutionStatus.PENDING
      ) {
        continue;
      }

      const predecessorsCompleted = execution.predecessorNodeIds.every((predNodeId) => {
        const predecessor = executionByNodeId.get(predNodeId);
        return predecessor?.status === ExecutionStatus.COMPLETED;
      });

      const shouldBeReady =
        execution.predecessorNodeIds.length === 0 || predecessorsCompleted;
      const nextStatus = shouldBeReady
        ? ExecutionStatus.READY
        : ExecutionStatus.PENDING;

      if (execution.status !== nextStatus) {
        execution.status = nextStatus;
        execution.updatedAt = new Date();
        this.store.nodeExecutions.set(execution.id, execution);
      }
    }
  }

  private cloneExecution(execution: NodeExecution): NodeExecution {
    return {
      ...execution,
      assignees: [...execution.assignees],
      predecessorNodeIds: [...execution.predecessorNodeIds],
      dueAt: execution.dueAt ? new Date(execution.dueAt) : undefined,
      startedAt: execution.startedAt ? new Date(execution.startedAt) : undefined,
      completedAt: execution.completedAt
        ? new Date(execution.completedAt)
        : undefined,
      gateResult: execution.gateResult
        ? this.cloneGateResult(execution.gateResult)
        : undefined,
      createdAt: new Date(execution.createdAt),
      updatedAt: new Date(execution.updatedAt),
    };
  }

  private cloneGateResult(gateResult: GateResult): GateResult {
    return {
      ...gateResult,
      checkedAt: new Date(gateResult.checkedAt),
      missingArtifacts: gateResult.missingArtifacts.map((item) => ({ ...item })),
    };
  }
}
