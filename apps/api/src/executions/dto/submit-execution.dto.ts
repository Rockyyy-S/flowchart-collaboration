import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitExecutionDto {
  /** 提交备注（可选，支持 auditor 复查时理解上下文） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
