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
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiTags('project-executions')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(ProjectAccessGuard)
export class ProjectExecutionsController {
  private readonly logger = new Logger(ProjectExecutionsController.name);

  constructor(private readonly executionsService: ExecutionsService) {}

  /**
   * 查询项目下所有节点执行实例（可按状态过滤）
   * GET /api/v1/projects/:projectId/executions?status=READY
   */
  @Get(':projectId/executions')
  @ApiOperation({ summary: '查询项目下执行实例列表' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiQuery({ name: 'status', required: false, description: '执行状态过滤' })
  @ApiOkResponse({ description: '查询成功' })
  findAll(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    try {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'project-executions.find-all.failed',
          projectId,
          status,
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 下个节点参与者审核通过上个节点（流程继续推进）
   * POST /api/v1/projects/:projectId/executions/:nodeId/approve
   * Body: { nextNodeId: string }
   * 权限：调用者必须是 nextNodeId 节点的 assignees 成员
   */
  @Post(':projectId/executions/:nodeId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '审核通过上一节点' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiParam({ name: 'nodeId', description: '被审核节点 ID' })
  @ApiOkResponse({ description: '审核通过' })
  approveNode(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: ApproveExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'project-executions.approve.failed',
          requestId: req.requestId || 'unknown',
          projectId,
          nodeId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 下个节点参与者拒绝上个节点（流程回退）
   * POST /api/v1/projects/:projectId/executions/:nodeId/reject
   * Body: { nextNodeId: string, reason: string }
   * 权限：调用者必须是 nextNodeId 节点的 assignees 成员
   */
  @Post(':projectId/executions/:nodeId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '拒绝上一节点并回退' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiParam({ name: 'nodeId', description: '被拒绝节点 ID' })
  @ApiOkResponse({ description: '拒绝成功' })
  rejectNode(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: RejectExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'project-executions.reject.failed',
          requestId: req.requestId || 'unknown',
          projectId,
          nodeId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }
}


/** 执行实例动作接口 */
@ApiTags('executions')
@ApiBearerAuth()
@Controller('executions')
@UseGuards(ExecutionAccessGuard)
export class ExecutionsController {
  private readonly logger = new Logger(ExecutionsController.name);

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
  @ApiOperation({ summary: '开始节点执行' })
  @ApiParam({ name: 'executionId', description: '执行实例 ID' })
  @ApiOkResponse({ description: '开始成功' })
  start(
    @Param('executionId') executionId: string,
    @Body() dto: StartExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'executions.start.failed',
          requestId: req.requestId || 'unknown',
          executionId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
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
  @ApiOperation({ summary: '提交执行并触发门禁' })
  @ApiParam({ name: 'executionId', description: '执行实例 ID' })
  @ApiOkResponse({ description: '提交成功' })
  submit(
    @Param('executionId') executionId: string,
    @Body() dto: SubmitExecutionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'executions.submit.failed',
          requestId: req.requestId || 'unknown',
          executionId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 查询门禁结果
   * GET /api/v1/executions/:executionId/gate-result
   */
  @Get(':executionId/gate-result')
  @ApiOperation({ summary: '查询门禁结果' })
  @ApiParam({ name: 'executionId', description: '执行实例 ID' })
  @ApiOkResponse({ description: '查询成功' })
  getGateResult(@Param('executionId') executionId: string) {
    try {
      return this.executionsService.getGateResult(executionId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'executions.get-gate-result.failed',
          executionId,
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
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
  @ApiOperation({ summary: '绑定执行输出物' })
  @ApiParam({ name: 'executionId', description: '执行实例 ID' })
  @ApiCreatedResponse({ description: '绑定成功' })
  bindArtifact(
    @Param('executionId') executionId: string,
    @Body() dto: BindArtifactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'executions.bind-artifact.failed',
          requestId: req.requestId || 'unknown',
          executionId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }
}
