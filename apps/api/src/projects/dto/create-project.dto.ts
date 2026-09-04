import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
  Matches,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TEAM_ID_PATTERN,
  USER_ID_PATTERN,
} from '../../common/constants/validation-patterns';



export class ProjectMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(USER_ID_PATTERN, {
    message: 'userId 仅允许字母、数字、下划线和短横线，长度 2-100',
  })
  userId: string;

  @IsIn(['OWNER', 'MEMBER', 'VIEWER'])
  role: 'OWNER' | 'MEMBER' | 'VIEWER';
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[^\r\n\t]{1,100}$/, {
    message: 'name 不能包含换行或制表符',
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 绑定的团队 ID（必填） */
  @IsString()
  @IsNotEmpty()
  @Matches(TEAM_ID_PATTERN, {
    message: 'teamId 格式不合法',
  })
  teamId: string;

  /** 初始成员列表（创建者自动注册为 OWNER，无需在此列出） */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberDto)
  members?: ProjectMemberDto[];
}
