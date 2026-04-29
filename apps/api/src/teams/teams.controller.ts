import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/**
 * 团队管理接口
 * 基础路径：/api/v1/teams
 * 全局 JwtAuthGuard 已在 main.ts 注册，此处无需重复声明
 */
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /**
   * 创建团队
   * POST /api/v1/teams
   * 自动将创建者加入成员列表
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTeamDto, @Req() req: AuthenticatedRequest) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const team = this.teamsService.create(dto, actorId, requestId);
    return {
      teamId: team.id,
      name: team.name,
      description: team.description,
      creatorId: team.creatorId,
      memberIds: team.memberIds,
      createdAt: team.createdAt,
    };
  }

  /**
   * 获取当前用户所在的所有团队
   * GET /api/v1/teams
   */
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId as string;
    return this.teamsService.findByUser(userId);
  }

  /**
   * 获取团队详情（仅团队成员可查看）
   * GET /api/v1/teams/:teamId
   */
  @Get(':teamId')
  findOne(@Param('teamId') teamId: string, @Req() req: AuthenticatedRequest) {
    const requesterId = req.user?.userId as string;
    return this.teamsService.findById(teamId, requesterId);
  }

  /**
   * 添加团队成员（仅创建者可操作）
   * POST /api/v1/teams/:teamId/members
   */
  @Post(':teamId/members')
  @HttpCode(HttpStatus.OK)
  addMember(
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const team = this.teamsService.addMember(teamId, dto, actorId, requestId);
    return {
      teamId: team.id,
      memberIds: team.memberIds,
    };
  }

  /**
   * 删除团队成员（仅创建者可操作；创建者本身不能被删除）
   * DELETE /api/v1/teams/:teamId/members/:memberId
   */
  @Delete(':teamId/members/:memberId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    const team = this.teamsService.removeMember(
      teamId,
      memberId,
      actorId,
      requestId,
    );
    return {
      teamId: team.id,
      memberIds: team.memberIds,
    };
  }

  /**
   * 删除团队（仅创建者可操作）
   * DELETE /api/v1/teams/:teamId
   */
  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTeam(
    @Param('teamId') teamId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = req.user?.userId as string;
    const requestId = req.requestId || 'unknown';
    this.teamsService.delete(teamId, actorId, requestId);
  }
}
