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
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiTags('teams')
@ApiBearerAuth()
export class TeamsController {
  private readonly logger = new Logger(TeamsController.name);

  constructor(private readonly teamsService: TeamsService) {}

  /**
   * 创建团队
   * POST /api/v1/teams
   * 自动将创建者加入成员列表
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建团队' })
  @ApiCreatedResponse({ description: '创建成功' })
  create(@Body() dto: CreateTeamDto, @Req() req: AuthenticatedRequest) {
    try {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'teams.create.failed',
          requestId: req.requestId || 'unknown',
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 获取当前用户所在的所有团队
   * GET /api/v1/teams
   */
  @Get()
  @ApiOperation({ summary: '查询当前用户团队列表' })
  @ApiOkResponse({ description: '查询成功' })
  findAll(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user?.userId as string;
      return this.teamsService.findByUser(userId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'teams.find-all.failed',
          requestId: req.requestId || 'unknown',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 获取团队详情（仅团队成员可查看）
   * GET /api/v1/teams/:teamId
   */
  @Get(':teamId')
  @ApiOperation({ summary: '查询团队详情' })
  @ApiParam({ name: 'teamId', description: '团队 ID' })
  @ApiOkResponse({ description: '查询成功' })
  findOne(@Param('teamId') teamId: string, @Req() req: AuthenticatedRequest) {
    try {
      const requesterId = req.user?.userId as string;
      return this.teamsService.findById(teamId, requesterId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'teams.find-one.failed',
          requestId: req.requestId || 'unknown',
          teamId,
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 添加团队成员（仅创建者可操作）
   * POST /api/v1/teams/:teamId/members
   */
  @Post(':teamId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '添加团队成员（仅创建者）' })
  @ApiParam({ name: 'teamId', description: '团队 ID' })
  @ApiOkResponse({ description: '添加成功' })
  addMember(
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const actorId = req.user?.userId as string;
      const requestId = req.requestId || 'unknown';
      const team = this.teamsService.addMember(teamId, dto, actorId, requestId);
      return {
        teamId: team.id,
        memberIds: team.memberIds,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'teams.add-member.failed',
          requestId: req.requestId || 'unknown',
          teamId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 删除团队成员（仅创建者可操作；创建者本身不能被删除）
   * DELETE /api/v1/teams/:teamId/members/:memberId
   */
  @Delete(':teamId/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '移除团队成员（仅创建者）' })
  @ApiParam({ name: 'teamId', description: '团队 ID' })
  @ApiParam({ name: 'memberId', description: '成员用户 ID' })
  @ApiOkResponse({ description: '移除成功' })
  removeMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'teams.remove-member.failed',
          requestId: req.requestId || 'unknown',
          teamId,
          memberId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }

  /**
   * 删除团队（仅创建者可操作）
   * DELETE /api/v1/teams/:teamId
   */
  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除团队（仅创建者）' })
  @ApiParam({ name: 'teamId', description: '团队 ID' })
  @ApiNoContentResponse({ description: '删除成功' })
  deleteTeam(
    @Param('teamId') teamId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const actorId = req.user?.userId as string;
      const requestId = req.requestId || 'unknown';
      this.teamsService.delete(teamId, actorId, requestId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'teams.delete.failed',
          requestId: req.requestId || 'unknown',
          teamId,
          actorId: req.user?.userId || 'anonymous',
          error: error instanceof Error ? error.message : 'unknown-error',
        }),
      );
      throw error;
    }
  }
}
