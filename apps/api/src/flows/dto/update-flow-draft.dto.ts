import {
  IsObject,
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsIn,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ArtifactRequirementDto {
  /** 在 flow 范围内稳定唯一，一经创建不允许删除重建 */
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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
  @MaxLength(80)
  nodeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  type?: string;

  /** 该节点的输出物要求列表 */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ArtifactRequirementDto)
  requiredArtifacts?: ArtifactRequirementDto[];

  /** 前置节点 nodeId 列表，用于自动解锁后继节点 */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  predecessorNodeIds?: string[];

  /** 执行人列表（用户 ID） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  assignees?: string[];

  /** 截止时间（ISO 8601 日期字符串） */
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** 节点描述 */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** 优先级：LOW | MEDIUM | HIGH | URGENT */
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  /** 预估工时（小时） */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  estimatedHours?: number;
}

export class UpdateFlowDraftDto {
  /** LogicFlow 兼容的图结构 JSON（节点与边） */
  @IsObject()
  graphJson: Record<string, unknown>;

  /** 节点配置列表（门禁规则与输出物要求） */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => NodeConfigDto)
  nodesConfig?: NodeConfigDto[];
}
