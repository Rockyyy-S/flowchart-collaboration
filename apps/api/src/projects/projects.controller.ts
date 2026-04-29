import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { MemoryRateLimitGuard } from '../common/guards/memory-rate-limit.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/** 项目管理接口 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * 获取当前用户参与的所有项目列表
   * GET /api/v1/projects
   * Header: Authorization: Bearer <token>
   * 返回项目基本信息、用户角色及节点执行进度摘要
   */
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId as string;
    return this.projectsService.findByUser(userId);
  }

  /**
   * 创建项目
   * POST /api/v1/projects
   * Header: Authorization: Bearer <token>
   */
  @Post()
  @UseGuards(MemoryRateLimitGuard)
  @RateLimit({
    keyPrefix: 'create-project',
    limit: 10,
    windowMs: 60_000,
    identifyBy: 'user',
  })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProjectDto, @Req() req: AuthenticatedRequest) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const { project, flowDefinition } = this.projectsService.create(
      dto,
      actorId,
      requestId,
    );
    return {
      projectId: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      status: project.status,
      teamId: project.teamId,
      defaultFlowDefinitionId: flowDefinition.id,
      createdAt: project.createdAt,
    };
  }

  /**
   * 删除项目（仅创建者/OWNER 可操作，级联删除所有关联数据）
   * DELETE /api/v1/projects/:projectId
   * Header: Authorization: Bearer <token>
   */
  @Delete(':projectId')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProject(
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    this.projectsService.deleteProject(projectId, actorId, requestId);
  }
}
