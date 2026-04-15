import { IsOptional, IsString } from 'class-validator';

export class StartExecutionDto {
  /** 操作者 ID（优先从 x-user-id Header 获取，此字段冗余兜底） */
  @IsOptional()
  @IsString()
  operatorId?: string;
}
