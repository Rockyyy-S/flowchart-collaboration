import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  Matches,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { USER_ID_PATTERN } from '../../common/constants/validation-patterns';

/** 创建团队请求体 */
export class CreateTeamDto {
  /** 团队名称（必填） */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[^\r\n\t]{1,100}$/, {
    message: 'name 不能包含换行或制表符',
  })
  name: string;

  /** 团队描述（可选） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 初始成员 ID 列表（可选；创建者会自动加入，无需在此列出） */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(USER_ID_PATTERN, {
    each: true,
    message: 'memberIds 中存在非法用户 ID',
  })
  memberIds?: string[];
}
