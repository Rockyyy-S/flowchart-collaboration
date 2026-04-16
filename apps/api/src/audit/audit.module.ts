import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ProjectAuditLogsController } from './audit.controller';

@Module({
  providers: [AuditService],
  controllers: [ProjectAuditLogsController],
  exports: [AuditService],
})
export class AuditModule {}
