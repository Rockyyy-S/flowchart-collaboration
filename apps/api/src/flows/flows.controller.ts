import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { FlowsService } from './flows.service';
import { UpdateFlowDraftDto } from './dto/update-flow-draft.dto';

/** 流程定义管理接口（嵌套在项目路由下） */
@Controller('projects')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  /**
   * 获取当前流程（已发布优先，无则返回草稿）
   * GET /api/v1/projects/:projectId/flows/current
   */
  @Get(':projectId/flows/current')
  getCurrentFlow(@Param('projectId') projectId: string) {
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
  }

  /**
   * 保存流程草稿（自动为新节点创建 NodeExecution）
   * PUT /api/v1/projects/:projectId/flows/draft
   */
  @Put(':projectId/flows/draft')
  @HttpCode(HttpStatus.OK)
  updateDraft(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateFlowDraftDto,
    @Req() req: Request,
  ) {
    const actorId = (req.headers['x-user-id'] as string) || 'anonymous';
    const requestId = (req as any).requestId || 'unknown';
    const flow = this.flowsService.updateDraft(projectId, dto, actorId, requestId);
    return {
      flowDefinitionId: flow.id,
      draftVersion: flow.version,
      nodeCount: flow.nodesConfig.length,
      updatedAt: flow.updatedAt,
    };
  }
}
