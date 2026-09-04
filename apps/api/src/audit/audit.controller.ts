import { Controller, Get, Logger, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(ProjectOwnerGuard)
export class ProjectAuditLogsController {
  private readonly logger = new Logger(ProjectAuditLogsController.name);

  constructor(private readonly auditService: AuditService) {}

  @Get(':projectId/audit-logs')
  @ApiOperation({ summary: '查询项目审计日志（仅 OWNER）' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiQuery({ name: 'resourceType', required: false, description: '资源类型过滤' })
  @ApiQuery({ name: 'resourceId', required: false, description: '资源 ID 过滤' })
  @ApiOkResponse({ description: '查询成功' })
  findAll(
    @Param('projectId') projectId: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    try {
      return this.auditService
        .findByProject(projectId, {
          resourceType,
          resourceId,
        })
        .map((log) => ({
          requestId: log.requestId,
          actorId: log.actorId,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          payload: log.payload,
          createdAt: log.createdAt,
        }));
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'audit.find-all.failed',
          projectId,
          resourceType,
          resourceId,
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }
}