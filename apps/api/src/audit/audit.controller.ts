import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';

@Controller('projects')
@UseGuards(ProjectOwnerGuard)
export class ProjectAuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':projectId/audit-logs')
  findAll(
    @Param('projectId') projectId: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.auditService.findByProject(projectId, {
      resourceType,
      resourceId,
    }).map((log) => ({
      requestId: log.requestId,
      actorId: log.actorId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      payload: log.payload,
      createdAt: log.createdAt,
    }));
  }
}