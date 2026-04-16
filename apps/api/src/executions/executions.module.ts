import { Module } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import {
  ExecutionsController,
  ProjectExecutionsController,
} from './executions.controller';
import { GateEngineService } from './gate-engine.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { ExecutionAccessGuard } from '../common/guards/execution-access.guard';

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [
    ExecutionsService,
    GateEngineService,
    ProjectAccessGuard,
    ExecutionAccessGuard,
  ],
  controllers: [ExecutionsController, ProjectExecutionsController],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
