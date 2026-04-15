import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitExecutionDto {
  /** 操作者 ID（兜底，优先读 Header） */
  @IsOptional()
  @IsString()
  operatorId?: string;

  /** 提交备注（可选，支持 auditor 复查时理解上下文） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
