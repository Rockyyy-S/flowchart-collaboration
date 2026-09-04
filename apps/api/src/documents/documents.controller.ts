import {
  Controller,
  Post,
  Get,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { MemoryRateLimitGuard } from '../common/guards/memory-rate-limit.guard';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/** 文档资产管理接口 */
@ApiTags('documents')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(ProjectAccessGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * 上传文档（MVP：提交元数据，模拟文件上传）
   * POST /api/v1/projects/:projectId/documents
   */
  @Post(':projectId/documents')
  @UseGuards(MemoryRateLimitGuard)
  @RateLimit({
    keyPrefix: 'create-document',
    limit: 20,
    windowMs: 60_000,
    identifyBy: 'user',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '上传文档元数据（MVP）' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiCreatedResponse({ description: '上传成功' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const actorId = req.user?.userId as string;
      const requestId = req.requestId || 'unknown';
      const document = this.documentsService.create(
        projectId,
        dto,
        actorId,
        requestId,
      );
      return {
        documentId: document.id,
        projectId: document.projectId,
        name: document.name,
        mimeType: document.mimeType,
        size: document.size,
        version: document.version,
        storageKey: document.storageKey,
        createdAt: document.createdAt,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'documents.create.failed',
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
   * 查询项目文档列表
   * GET /api/v1/projects/:projectId/documents
   */
  @Get(':projectId/documents')
  @ApiOperation({ summary: '查询项目文档列表' })
  @ApiParam({ name: 'projectId', description: '项目 ID' })
  @ApiOkResponse({ description: '查询成功' })
  findAll(@Param('projectId') projectId: string) {
    try {
      const docs = this.documentsService.findByProject(projectId);
      return docs.map((d) => ({
        documentId: d.id,
        name: d.name,
        mimeType: d.mimeType,
        size: d.size,
        version: d.version,
        createdAt: d.createdAt,
      }));
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'documents.find-all.failed',
          projectId,
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }
}
