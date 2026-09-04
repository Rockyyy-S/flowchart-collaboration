import {
  Controller,
  Get,
  Put,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FlowsService } from './flows.service';
import { UpdateFlowDraftDto } from './dto/update-flow-draft.dto';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/** 流程定义管理接口（嵌套在项目路由下） */
@ApiTags('flows')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(ProjectAccessGuard)
export class FlowsController {
  private readonly logger = new Logger(FlowsController.name);

  constructor(private readonly flowsService: FlowsService) {}

  /**
   * 获取当前流程（已发布优先，无则返回草稿）
   * GET /api/v1/projects/:projectId/flows/current
   */
  @Get(':projectId/flows/current')
  @ApiOperation({ summary: '获取项目当前流程定义' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiOkResponse({ description: '查询成功' })
  getCurrentFlow(@Param('projectId') projectId: string) {
    try {
      const flow = this.flowsService.getCurrentFlow(projectId);
      return {
        flowDefinitionId: flow.id,
        projectId: flow.projectId,
        version: flow.version,
        publishStatus: flow.publishStatus,
        graphJson: flow.graphJson,
        nodesConfig: flow.nodesConfig,
        updatedAt: flow.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'flows.get-current.failed',
          projectId,
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 保存流程草稿（自动为新节点创建 NodeExecution）
   * PUT /api/v1/projects/:projectId/flows/draft
   */
  @Put(':projectId/flows/draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '保存流程草稿' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiOkResponse({ description: '保存成功' })
  updateDraft(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateFlowDraftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const actorId = req.user?.userId as string;
      const requestId = req.requestId || 'unknown';
      const flow = this.flowsService.updateDraft(
        projectId,
        dto,
        actorId,
        requestId,
      );
      return {
        flowDefinitionId: flow.id,
        draftVersion: flow.version,
        nodeCount: flow.nodesConfig.length,
        updatedAt: flow.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'flows.update-draft.failed',
          requestId: req.requestId || 'unknown',
          projectId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }
}
