import { Module } from '@nestjs/common';
import { FlowsService } from './flows.service';
import { FlowsController } from './flows.controller';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AuditModule, ProjectsModule],
  providers: [FlowsService],
  controllers: [FlowsController],
  exports: [FlowsService],
})
export class FlowsModule {}
