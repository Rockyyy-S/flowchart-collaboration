import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SubmitExecutionDto {
  /** 提交备注（可选，支持 auditor 复查时理解上下文） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^[^\t]*$/, { message: 'comment 不能包含制表符' })
  comment?: string;
}
