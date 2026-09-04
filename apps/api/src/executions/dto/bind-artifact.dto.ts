import { IsString, IsOptional, IsNotEmpty, MaxLength, IsUrl, Matches } from 'class-validator';
import {
  GENERIC_ID_PATTERN,
} from '../../common/constants/validation-patterns';

export class BindArtifactDto {
  /** 对应 NodeConfig.requiredArtifacts[].id，必须稳定可追溯 */
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(GENERIC_ID_PATTERN, {
    message: 'requirementId 格式不合法',
  })
  requirementId: string;

  /**
   * 平台内文档 ID（门禁唯一认可的绑定类型）
   * documentId 与 externalUrl 至少填写一项
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(GENERIC_ID_PATTERN, {
    message: 'documentId 格式不合法',
  })
  documentId?: string;

  /**
   * 外部链接（Figma/Confluence 等）
   * 仅供参考记录，架构约束：外链不计入门禁通过条件
   */
  @IsOptional()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
    },
    { message: 'externalUrl 必须为合法 http/https URL' },
  )
  @MaxLength(500)
  externalUrl?: string;
}
