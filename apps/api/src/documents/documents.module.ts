import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';

@Module({
  imports: [AuditModule, ProjectsModule],
  providers: [DocumentsService, ProjectAccessGuard],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
