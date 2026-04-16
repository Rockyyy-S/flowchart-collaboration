import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StoreService } from '../../shared/store.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class ExecutionAccessGuard implements CanActivate {
  constructor(private readonly store: StoreService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const executionId = request.params.executionId;
    const userId = request.user?.userId;

    if (!executionId) {
      return true;
    }

    const execution = this.store.nodeExecutions.get(executionId);
    if (!execution) {
      throw new NotFoundException({
        code: 'EXECUTION_NOT_FOUND',
        message: `执行实例 ${executionId} 不存在`,
      });
    }

    const project = this.store.projects.get(execution.projectId);
    if (!project || !userId) {
      throw new ForbiddenException({
        code: 'PROJECT_FORBIDDEN',
        message: '无权访问此项目',
      });
    }

    if (project.ownerId === userId) {
      return true;
    }

    const isMember = [...this.store.projectMembers.values()].some(
      (member) => member.projectId === execution.projectId && member.userId === userId,
    );

    if (!isMember) {
      throw new ForbiddenException({
        code: 'PROJECT_FORBIDDEN',
        message: '无权访问此项目',
      });
    }

    return true;
  }
}
