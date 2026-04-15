import {
  IsObject,
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  ValidateNested,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ArtifactRequirementDto {
  /** 在 flow 范围内稳定唯一，一经创建不允许删除重建 */
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsIn(['DOCUMENT', 'ANY'])
  sourceType?: 'DOCUMENT' | 'ANY';
}

export class NodeConfigDto {
  @IsString()
  @IsNotEmpty()
  nodeId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  type?: string;

  /** 该节点的输出物要求列表 */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArtifactRequirementDto)
  requiredArtifacts?: ArtifactRequirementDto[];

  /** 前置节点 nodeId 列表，用于自动解锁后继节点 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  predecessorNodeIds?: string[];
}

export class UpdateFlowDraftDto {
  /** LogicFlow 兼容的图结构 JSON（节点与边） */
  @IsObject()
  graphJson: Record<string, unknown>;

  /** 节点配置列表（门禁规则与输出物要求） */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeConfigDto)
  nodesConfig?: NodeConfigDto[];
}
