import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

/** 创建团队请求体 */
export class CreateTeamDto {
  /** 团队名称（必填） */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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
  memberIds?: string[];
}
