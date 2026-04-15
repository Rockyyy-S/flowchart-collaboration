import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

/** 项目管理接口 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * 创建项目
   * POST /api/v1/projects
   * Header: x-user-id（MVP 用于模拟用户身份）
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const actorId = (req.headers['x-user-id'] as string) || 'anonymous';
    const requestId = (req as any).requestId || 'unknown';
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
