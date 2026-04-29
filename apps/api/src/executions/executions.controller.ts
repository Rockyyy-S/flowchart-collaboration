import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { StartExecutionDto } from './dto/start-execution.dto';
import { SubmitExecutionDto } from './dto/submit-execution.dto';
import { BindArtifactDto } from './dto/bind-artifact.dto';
import { ApproveExecutionDto } from './dto/approve-execution.dto';
import { RejectExecutionDto } from './dto/reject-execution.dto';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { ExecutionAccessGuard } from '../common/guards/execution-access.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { MemoryRateLimitGuard } from '../common/guards/memory-rate-limit.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/**
 * 项目维度的执行列表查询
 * 路由前缀：projects（与 ProjectsController 共享前缀，NestJS 允许多 Controller 共享）
 */
@Controller('projects')
@UseGuards(ProjectAccessGuard)
export class ProjectExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  /**
   * 查询项目下所有节点执行实例（可按状态过滤）
   * GET /api/v1/projects/:projectId/executions?status=READY
   */
  @Get(':projectId/executions')
  findAll(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    const executions = this.executionsService.findByProject(projectId, status);
    return executions.map((e) => ({
      executionId: e.id,
      nodeId: e.nodeId,
      nodeName: e.nodeName,
      status: e.status,
      assignees: e.assignees,
      dueAt: e.dueAt,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      updatedAt: e.updatedAt,
    }));
  }

  /**
   * 下个节点参与者审核通过上个节点（流程继续推进）
   * POST /api/v1/projects/:projectId/executions/:nodeId/approve
   * Body: { nextNodeId: string }
   * 权限：调用者必须是 nextNodeId 节点的 assignees 成员
   */
  @Post(':projectId/executions/:nodeId/approve')
  @HttpCode(HttpStatus.OK)
  approveNode(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: ApproveExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const { reviewed, next } = this.executionsService.approve(
      projectId,
      nodeId,
      dto,
      actorId,
      requestId,
    );
    return {
      reviewedNodeId: reviewed.nodeId,
      reviewedStatus: reviewed.status,
      reviewResult: reviewed.reviewResult,
      nextNodeId: next.nodeId,
      nextStatus: next.status,
    };
  }

  /**
   * 下个节点参与者拒绝上个节点（流程回退）
   * POST /api/v1/projects/:projectId/executions/:nodeId/reject
   * Body: { nextNodeId: string, reason: string }
   * 权限：调用者必须是 nextNodeId 节点的 assignees 成员
   */
  @Post(':projectId/executions/:nodeId/reject')
  @HttpCode(HttpStatus.OK)
  rejectNode(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: RejectExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const rejected = this.executionsService.reject(
      projectId,
      nodeId,
      dto,
      actorId,
      requestId,
    );
    return {
      rejectedNodeId: rejected.nodeId,
      status: rejected.status,
      rejectionReason: rejected.rejectionReason,
      reviewResult: rejected.reviewResult,
    };
  }
}


/** 执行实例动作接口 */
@Controller('executions')
@UseGuards(ExecutionAccessGuard)
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  /**
   * 开始节点执行（READY | NEEDS_FIX → IN_PROGRESS）
   * POST /api/v1/executions/:executionId/start
   */
  @Post(':executionId/start')
  @UseGuards(MemoryRateLimitGuard)
  @RateLimit({
    keyPrefix: 'start-execution',
    limit: 20,
    windowMs: 60_000,
    identifyBy: 'user',
  })
  @HttpCode(HttpStatus.OK)
  start(
    @Param('executionId') executionId: string,
    @Body() dto: StartExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const execution = this.executionsService.start(
      executionId,
      dto,
      actorId,
      requestId,
    );
    return {
      executionId: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
    };
  }

  /**
   * 提交节点完成并触发门禁校验（IN_PROGRESS → COMPLETED | NEEDS_FIX）
   * POST /api/v1/executions/:executionId/submit
   */
  @Post(':executionId/submit')
  @UseGuards(MemoryRateLimitGuard)
  @RateLimit({
    keyPrefix: 'submit-execution',
    limit: 20,
    windowMs: 60_000,
    identifyBy: 'user',
  })
  @HttpCode(HttpStatus.OK)
  submit(
    @Param('executionId') executionId: string,
    @Body() dto: SubmitExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const execution = this.executionsService.submit(
      executionId,
      dto,
      actorId,
      requestId,
    );
    return {
      executionId: execution.id,
      status: execution.status,
      gatePass: execution.gateResult?.pass,
      missingArtifacts: execution.gateResult?.missingArtifacts || [],
      completedAt: execution.completedAt,
    };
  }

  /**
   * 查询门禁结果
   * GET /api/v1/executions/:executionId/gate-result
   */
  @Get(':executionId/gate-result')
  getGateResult(@Param('executionId') executionId: string) {
    return this.executionsService.getGateResult(executionId);
  }

  /**
   * 绑定输出物（documentId 计入门禁，externalUrl 仅供参考）
   * POST /api/v1/executions/:executionId/artifacts/bind
   */
  @Post(':executionId/artifacts/bind')
  @UseGuards(MemoryRateLimitGuard)
  @RateLimit({
    keyPrefix: 'bind-artifact',
    limit: 30,
    windowMs: 60_000,
    identifyBy: 'user',
  })
  @HttpCode(HttpStatus.CREATED)
  bindArtifact(
    @Param('executionId') executionId: string,
    @Body() dto: BindArtifactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const binding = this.executionsService.bindArtifact(
      executionId,
      dto,
      actorId,
      requestId,
    );
    return {
      bindingId: binding.id,
      nodeExecutionId: binding.nodeExecutionId,
      requirementId: binding.requirementId,
      documentId: binding.documentId,
      externalUrl: binding.externalUrl,
      boundAt: binding.boundAt,
    };
  }
}
