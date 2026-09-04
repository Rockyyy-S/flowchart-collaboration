import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  MaxLength,
  IsIn,
  Max,
  Matches,
} from 'class-validator';

/** 文档上传 DTO（MVP 阶段模拟上传，仅提交元数据，不实际传输文件） */
export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/^[^\r\n\t]+$/, {
    message: 'name 不能包含换行或制表符',
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain',
    'image/png',
    'image/jpeg',
  ])
  mimeType: string;

  /** 文件大小（字节），限制 10MB */
  @IsNumber()
  @IsPositive()
  @Max(10 * 1024 * 1024)
  size: number;
}
