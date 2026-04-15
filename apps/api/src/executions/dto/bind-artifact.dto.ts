import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class BindArtifactDto {
  /** 对应 NodeConfig.requiredArtifacts[].id，必须稳定可追溯 */
  @IsString()
  @IsNotEmpty()
  requirementId: string;

  /**
   * 平台内文档 ID（门禁唯一认可的绑定类型）
   * documentId 与 externalUrl 至少填写一项
   */
  @IsOptional()
  @IsString()
  documentId?: string;

  /**
   * 外部链接（Figma/Confluence 等）
   * 仅供参考记录，架构约束：外链不计入门禁通过条件
   */
  @IsOptional()
  @IsString()
  externalUrl?: string;
}
