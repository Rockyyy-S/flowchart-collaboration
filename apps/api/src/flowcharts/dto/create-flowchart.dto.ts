import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  Matches,
  MaxLength,
} from 'class-validator';
import { USER_ID_PATTERN } from '../../common/constants/validation-patterns';

/** 创建流程图请求体 */
export class CreateFlowchartDto {
  /** 流程图名称（必填） */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[^\r\n\t]{1,100}$/, {
    message: 'name 不能包含换行或制表符',
  })
  name: string;

  /** 流程图描述（可选） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 负责人用户 ID（可选；不填时默认为当前登录用户） */
  @IsOptional()
  @IsString()
  @Matches(USER_ID_PATTERN, {
    message: 'ownerId 格式不合法',
  })
  ownerId?: string;

  /** 截止时间（可选，ISO 8601 格式） */
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
