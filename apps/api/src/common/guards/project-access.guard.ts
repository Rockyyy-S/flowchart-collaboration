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
export class ProjectAccessGuard implements CanActivate {
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

    if (!userId) {
      throw new ForbiddenException({
        code: 'PROJECT_FORBIDDEN',
        message: '无权访问此项目',
      });
    }

    if (project.ownerId === userId) {
      return true;
    }

    const isMember = [...this.store.projectMembers.values()].some(
      (member) => member.projectId === projectId && member.userId === userId,
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
