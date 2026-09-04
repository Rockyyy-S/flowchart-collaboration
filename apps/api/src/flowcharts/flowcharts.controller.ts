import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FlowchartsService } from './flowcharts.service';
import { CreateFlowchartDto } from './dto/create-flowchart.dto';
import { CreateSubFlowchartDto } from './dto/create-sub-flowchart.dto';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/**
 * 流程图管理接口
 * 全局 JwtAuthGuard 已在 main.ts 注册
 */
@Controller()
@ApiTags('flowcharts')
@ApiBearerAuth()
export class FlowchartsController {
  private readonly logger = new Logger(FlowchartsController.name);

  constructor(private readonly flowchartsService: FlowchartsService) {}

  /**
   * 获取项目下所有流程图（含子流程图）
   * GET /api/v1/projects/:projectId/flowcharts
   */
  @Get('projects/:projectId/flowcharts')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: '查询项目流程图列表' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiOkResponse({ description: '查询成功' })
  findByProject(@Param('projectId') projectId: string) {
    try {
      return this.flowchartsService.findByProject(projectId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'flowcharts.find-by-project.failed',
          projectId,
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 在项目下创建顶层流程图
   * POST /api/v1/projects/:projectId/flowcharts
   */
  @Post('projects/:projectId/flowcharts')
  @UseGuards(ProjectAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建顶层流程图' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiCreatedResponse({ description: '创建成功' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateFlowchartDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const actorId = req.user?.userId as string;
      const requestId = req.requestId || 'unknown';
      const flowchart = this.flowchartsService.create(
        projectId,
        dto,
        actorId,
        requestId,
      );
      return {
        flowchartId: flowchart.id,
        name: flowchart.name,
        projectId: flowchart.projectId,
        ownerId: flowchart.ownerId,
        status: flowchart.status,
        nodeCount: flowchart.nodeCount,
        createdAt: flowchart.createdAt,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'flowcharts.create.failed',
          requestId: req.requestId || 'unknown',
          projectId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 在父流程图下创建子流程图
   * POST /api/v1/flowcharts/:flowchartId/sub-flowcharts
   * 需要提供 parentNodeId（从哪个有分支任务节点分支出去的）
   */
  @Post('flowcharts/:flowchartId/sub-flowcharts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建子流程图' })
  @ApiParam({ name: 'flowchartId', description: '父流程图 ID' })
  @ApiCreatedResponse({ description: '创建成功' })
  createSubFlowchart(
    @Param('flowchartId') flowchartId: string,
    @Body() dto: CreateSubFlowchartDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const actorId = req.user?.userId as string;
      const requestId = req.requestId || 'unknown';
      const subFlowchart = this.flowchartsService.createSubFlowchart(
        flowchartId,
        dto,
        actorId,
        requestId,
      );
      return {
        flowchartId: subFlowchart.id,
        name: subFlowchart.name,
        projectId: subFlowchart.projectId,
        ownerId: subFlowchart.ownerId,
        parentFlowchartId: subFlowchart.parentFlowchartId,
        parentNodeId: subFlowchart.parentNodeId,
        status: subFlowchart.status,
        nodeCount: subFlowchart.nodeCount,
        createdAt: subFlowchart.createdAt,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'flowcharts.create-sub.failed',
          requestId: req.requestId || 'unknown',
          flowchartId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 删除流程图（级联删除所有子流程图）
   * DELETE /api/v1/flowcharts/:flowchartId
   */
  @Delete('flowcharts/:flowchartId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除流程图（级联子流程图）' })
  @ApiParam({ name: 'flowchartId', description: '流程图 ID' })
  @ApiNoContentResponse({ description: '删除成功' })
  delete(
    @Param('flowchartId') flowchartId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const actorId = req.user?.userId as string;
      const requestId = req.requestId || 'unknown';
      this.flowchartsService.delete(flowchartId, actorId, requestId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'flowcharts.delete.failed',
          requestId: req.requestId || 'unknown',
          flowchartId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }
}
