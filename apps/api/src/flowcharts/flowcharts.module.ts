import { Module } from '@nestjs/common';
import { FlowchartsService } from './flowcharts.service';
import { FlowchartsController } from './flowcharts.controller';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';

/** 流程图管理模块（独立实体，支持子流程图关联） */
@Module({
  imports: [AuditModule, ProjectsModule],
  providers: [FlowchartsService, ProjectAccessGuard],
  controllers: [FlowchartsController],
  exports: [FlowchartsService],
})
export class FlowchartsModule {}
