import { IsString, IsNotEmpty } from 'class-validator';

/** 添加团队成员请求体 */
export class AddTeamMemberDto {
  /** 被添加的用户 ID（必填） */
  @IsString()
  @IsNotEmpty()
  memberId: string;
}
