import { Module } from '@nestjs/common';
import { FlowsService } from './flows.service';
import { FlowsController } from './flows.controller';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';

@Module({
  imports: [AuditModule, ProjectsModule],
  providers: [FlowsService, ProjectAccessGuard],
  controllers: [FlowsController],
  exports: [FlowsService],
})
export class FlowsModule {}
