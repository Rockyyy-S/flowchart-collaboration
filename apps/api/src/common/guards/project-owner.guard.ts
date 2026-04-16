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
export class ProjectOwnerGuard implements CanActivate {
  constructor(private readonly store: StoreService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const projectId = request.params.projectId;
    const userId = request.user?.userId;

    if (!projectId) {
      return true;
    }

    const project = this.store.projects.get(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: `项目 ${projectId} 不存在`,
      });
    }

    if (!userId || project.ownerId !== userId) {
      throw new ForbiddenException({
        code: 'PROJECT_OWNER_REQUIRED',
        message: '仅项目 OWNER 可访问此资源',
      });
    }

    return true;
  }
}