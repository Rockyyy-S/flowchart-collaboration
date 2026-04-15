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
} from '@nestjs/common';
import { Request } from 'express';
import { ExecutionsService } from './executions.service';
import { StartExecutionDto } from './dto/start-execution.dto';
import { SubmitExecutionDto } from './dto/submit-execution.dto';
import { BindArtifactDto } from './dto/bind-artifact.dto';

/**
 * 项目维度的执行列表查询
 * 路由前缀：projects（与 ProjectsController 共享前缀，NestJS 允许多 Controller 共享）
 */
@Controller('projects')
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
}

/** 执行实例动作接口 */
@Controller('executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  /**
   * 开始节点执行（READY | NEEDS_FIX → IN_PROGRESS）
   * POST /api/v1/executions/:executionId/start
   */
  @Post(':executionId/start')
  @HttpCode(HttpStatus.OK)
  start(
    @Param('executionId') executionId: string,
    @Body() dto: StartExecutionDto,
    @Req() req: Request,
  ) {
    const actorId = (req.headers['x-user-id'] as string) || 'anonymous';
    const requestId = (req as any).requestId || 'unknown';
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
  @HttpCode(HttpStatus.OK)
  submit(
    @Param('executionId') executionId: string,
    @Body() dto: SubmitExecutionDto,
    @Req() req: Request,
  ) {
    const actorId = (req.headers['x-user-id'] as string) || 'anonymous';
    const requestId = (req as any).requestId || 'unknown';
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
  @HttpCode(HttpStatus.CREATED)
  bindArtifact(
    @Param('executionId') executionId: string,
    @Body() dto: BindArtifactDto,
    @Req() req: Request,
  ) {
    const actorId = (req.headers['x-user-id'] as string) || 'anonymous';
    const requestId = (req as any).requestId || 'unknown';
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
