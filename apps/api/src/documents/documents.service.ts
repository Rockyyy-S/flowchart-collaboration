import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StoreService } from '../shared/store.service';
import { AuditService } from '../audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { Document } from '../common/interfaces/entities.interface';
import { CreateDocumentDto } from './dto/create-document.dto';
import { sanitizeFilename } from '../common/utils/file-sanitizer';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly store: StoreService,
    private readonly auditService: AuditService,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * 创建文档元数据记录（MVP：模拟上传，不实际存储二进制文件）
   * 正式版本：服务端签名上传或中转上传后调用此方法落库
   */
  create(
    projectId: string,
    dto: CreateDocumentDto,
    actorId: string,
    requestId: string,
  ): Document {
    this.projectsService.findById(projectId);

    const documentId = uuidv4();
    const now = new Date();
    const safeFilename = sanitizeFilename(dto.name);
    const storageKey = `${projectId}/${documentId}/v1/${safeFilename}`;

    const document: Document = {
      id: documentId,
      projectId,
      name: dto.name,
      mimeType: dto.mimeType,
      size: dto.size,
      storageKey,
      version: 1,
      uploadedBy: actorId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.documents.set(documentId, document);

    this.auditService.record({
      projectId,
      requestId,
      actorId,
      action: 'CREATE_DOCUMENT',
      resourceType: 'Document',
      resourceId: documentId,
      payload: { projectId, name: dto.name, size: dto.size },
    });

    return document;
  }

  findById(documentId: string): Document {
    const doc = this.store.documents.get(documentId);
    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: `文档 ${documentId} 不存在`,
      });
    }
    return doc;
  }

  findByProject(projectId: string): Document[] {
    return [...this.store.documents.values()].filter(
      (d) => d.projectId === projectId,
    );
  }
}
