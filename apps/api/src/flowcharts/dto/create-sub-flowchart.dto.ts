import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

/** 创建子流程图请求体 */
export class CreateSubFlowchartDto {
  /** 子流程图名称（必填） */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /** 子流程图描述（可选） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 负责人用户 ID（可选；不填时默认为当前登录用户） */
  @IsOptional()
  @IsString()
  ownerId?: string;

  /**
   * 产生此子流程图的父节点 ID（必填）
   * 子流程图从哪个有分支任务节点分支出去的
   */
  @IsString()
  @IsNotEmpty()
  parentNodeId: string;

  /** 截止时间（可选，ISO 8601 格式） */
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
