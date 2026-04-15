import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  MaxLength,
} from 'class-validator';

/** 文档上传 DTO（MVP 阶段模拟上传，仅提交元数据，不实际传输文件） */
export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  /** 文件大小（字节），由客户端提供；正式版本由服务端二次校验 */
  @IsNumber()
  @IsPositive()
  size: number;

  /**
   * 对象存储路径（可选）
   * 规范：/{projectId}/{documentId}/v{n}/{filename}
   * 正式版本改为服务端签名上传后由回调写入，客户端不再传此字段
   */
  @IsOptional()
  @IsString()
  storageKey?: string;
}
