import { Module } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import {
  ExecutionsController,
  ProjectExecutionsController,
} from './executions.controller';
import { GateEngineService } from './gate-engine.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [ExecutionsService, GateEngineService],
  controllers: [ExecutionsController, ProjectExecutionsController],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
