import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

/** 创建流程图请求体 */
export class CreateFlowchartDto {
  /** 流程图名称（必填） */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /** 流程图描述（可选） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 负责人用户 ID（可选；不填时默认为当前登录用户） */
  @IsOptional()
  @IsString()
  ownerId?: string;

  /** 截止时间（可选，ISO 8601 格式） */
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
