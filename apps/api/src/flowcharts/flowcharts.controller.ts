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
  UseGuards,
} from '@nestjs/common';
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
export class FlowchartsController {
  constructor(private readonly flowchartsService: FlowchartsService) {}

  /**
   * 获取项目下所有流程图（含子流程图）
   * GET /api/v1/projects/:projectId/flowcharts
   */
  @Get('projects/:projectId/flowcharts')
  @UseGuards(ProjectAccessGuard)
  findByProject(@Param('projectId') projectId: string) {
    return this.flowchartsService.findByProject(projectId);
  }

  /**
   * 在项目下创建顶层流程图
   * POST /api/v1/projects/:projectId/flowcharts
   */
  @Post('projects/:projectId/flowcharts')
  @UseGuards(ProjectAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateFlowchartDto,
    @Req() req: AuthenticatedRequest,
  ) {
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
  }

  /**
   * 在父流程图下创建子流程图
   * POST /api/v1/flowcharts/:flowchartId/sub-flowcharts
   * 需要提供 parentNodeId（从哪个有分支任务节点分支出去的）
   */
  @Post('flowcharts/:flowchartId/sub-flowcharts')
  @HttpCode(HttpStatus.CREATED)
  createSubFlowchart(
    @Param('flowchartId') flowchartId: string,
    @Body() dto: CreateSubFlowchartDto,
    @Req() req: AuthenticatedRequest,
  ) {
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
  }

  /**
   * 删除流程图（级联删除所有子流程图）
   * DELETE /api/v1/flowcharts/:flowchartId
   */
  @Delete('flowcharts/:flowchartId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('flowchartId') flowchartId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    this.flowchartsService.delete(flowchartId, actorId, requestId);
  }
}
