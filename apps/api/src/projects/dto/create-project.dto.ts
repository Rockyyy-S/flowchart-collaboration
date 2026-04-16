import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId: string;

  @IsIn(['OWNER', 'MEMBER', 'VIEWER'])
  role: 'OWNER' | 'MEMBER' | 'VIEWER';
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 初始成员列表（创建者自动注册为 OWNER，无需在此列出） */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberDto)
  members?: ProjectMemberDto[];
}
