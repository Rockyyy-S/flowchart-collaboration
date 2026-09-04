import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { USER_ID_PATTERN } from '../../common/constants/validation-patterns';

/** 添加团队成员请求体 */
export class AddTeamMemberDto {
  /** 被添加的用户 ID（必填） */
  @IsString()
  @IsNotEmpty()
  @Matches(USER_ID_PATTERN, {
    message: 'memberId 仅允许字母、数字、下划线和短横线，长度 2-100',
  })
  memberId: string;
}
