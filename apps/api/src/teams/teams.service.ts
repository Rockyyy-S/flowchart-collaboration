import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { StoreService } from '../shared/store.service';
import { AuditService } from '../audit/audit.service';
import { Team } from '../common/interfaces/entities.interface';
import { generateId } from '../common/utils/generate-id.util';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';

@Injectable()
export class TeamsService {
  constructor(
    private readonly store: StoreService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 创建团队
   * - 自动将创建者加入成员列表
   * - 初始成员列表去重
   */
  create(dto: CreateTeamDto, actorId: string, requestId: string): Team {
    const teamId = generateId('team-');
    const now = new Date();

    // 去重合并：创建者 + 初始成员
    const memberSet = new Set<string>([actorId, ...(dto.memberIds ?? [])]);

    const team: Team = {
      id: teamId,
      name: dto.name,
      description: dto.description,
      creatorId: actorId,
      memberIds: [...memberSet],
      createdAt: now,
    };
    this.store.teams.set(teamId, team);

    // 写审计日志（团队操作 projectId 使用 N/A）
    this.auditService.record({
      projectId: 'N/A',
      requestId,
      actorId,
      action: 'CREATE_TEAM',
      resourceType: 'Team',
      resourceId: teamId,
      payload: { name: dto.name, memberCount: team.memberIds.length },
    });

    return team;
  }

  /**
   * 获取当前用户所在的所有团队列表
   */
  findByUser(userId: string): Team[] {
    return [...this.store.teams.values()].filter((t) =>
      t.memberIds.includes(userId),
    );
  }

  /**
   * 按 ID 查找团队（需验证调用者是成员）
   */
  findById(teamId: string, requesterId?: string): Team {
    const team = this.store.teams.get(teamId);
    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `团队 ${teamId} 不存在`,
      });
    }
    if (requesterId && !team.memberIds.includes(requesterId)) {
      throw new ForbiddenException({
        code: 'TEAM_FORBIDDEN',
        message: '仅团队成员可查看团队详情',
      });
    }
    return team;
  }

  /**
   * 添加团队成员（仅创建者可操作）
   */
  addMember(
    teamId: string,
    dto: AddTeamMemberDto,
    actorId: string,
    requestId: string,
  ): Team {
    const team = this.findById(teamId);
    this.assertCreator(team, actorId);

    // 已是成员则直接返回（幂等）
    if (team.memberIds.includes(dto.memberId)) {
      return team;
    }

    team.memberIds = [...team.memberIds, dto.memberId];
    this.store.teams.set(teamId, team);

    this.auditService.record({
      projectId: 'N/A',
      requestId,
      actorId,
      action: 'ADD_TEAM_MEMBER',
      resourceType: 'Team',
      resourceId: teamId,
      payload: { memberId: dto.memberId },
    });

    return team;
  }

  /**
   * 删除团队成员（仅创建者可操作；创建者本身不能被删除）
   */
  removeMember(
    teamId: string,
    memberId: string,
    actorId: string,
    requestId: string,
  ): Team {
    const team = this.findById(teamId);
    this.assertCreator(team, actorId);

    if (memberId === team.creatorId) {
      throw new BadRequestException({
        code: 'CANNOT_REMOVE_CREATOR',
        message: '团队创建者不能被移除',
      });
    }

    team.memberIds = team.memberIds.filter((id) => id !== memberId);
    this.store.teams.set(teamId, team);

    this.auditService.record({
      projectId: 'N/A',
      requestId,
      actorId,
      action: 'REMOVE_TEAM_MEMBER',
      resourceType: 'Team',
      resourceId: teamId,
      payload: { memberId },
    });

    return team;
  }

  /**
   * 删除团队（仅创建者可操作）
   */
  delete(teamId: string, actorId: string, requestId: string): void {
    const team = this.findById(teamId);
    this.assertCreator(team, actorId);

    this.store.teams.delete(teamId);

    this.auditService.record({
      projectId: 'N/A',
      requestId,
      actorId,
      action: 'DELETE_TEAM',
      resourceType: 'Team',
      resourceId: teamId,
      payload: { name: team.name },
    });
  }

  /**
   * 断言调用者是团队创建者，否则抛出 403
   */
  private assertCreator(team: Team, actorId: string): void {
    if (team.creatorId !== actorId) {
      throw new ForbiddenException({
        code: 'TEAM_CREATOR_REQUIRED',
        message: '仅团队创建者可执行此操作',
      });
    }
  }
}
