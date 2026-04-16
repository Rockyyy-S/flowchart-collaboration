import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { MemoryRateLimitGuard } from '../common/guards/memory-rate-limit.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/** 项目管理接口 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

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
      defaultFlowDefinitionId: flowDefinition.id,
      createdAt: project.createdAt,
    };
  }
}
