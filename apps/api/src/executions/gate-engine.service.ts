import { Injectable, Logger } from '@nestjs/common';
import { StoreService } from '../shared/store.service';
import {
  NodeExecution,
  GateResult,
  MissingArtifact,
} from '../common/interfaces/entities.interface';

/**
 * 门禁引擎（Gate Engine）
 *
 * MVP 实现：必需输出物存在性校验
 * - 检查节点配置中所有 required=true 的 ArtifactRequirement
 * - 每项必须有对应的 ArtifactBinding 且 documentId 不为空（外链不计入）
 *
 * 扩展点（后续版本）：
 * - Pro 版：文件数量、类型、大小、命名规范校验
 * - Enterprise 版：文档内容 AI 校验、多人审批确认
 */
@Injectable()
export class GateEngineService {
  private readonly logger = new Logger(GateEngineService.name);

  constructor(private readonly store: StoreService) {}

  /**
   * 执行门禁校验
   * @param execution 当前节点执行实例
   * @returns GateResult { pass, checkedAt, missingArtifacts }
   */
  check(execution: NodeExecution): GateResult {
    const flowDef = this.store.flowDefinitions.get(execution.flowDefinitionId);
    if (!flowDef) {
      this.logger.warn(
        `门禁校验：找不到流程定义 ${execution.flowDefinitionId}，默认通过`,
      );
      return { pass: true, checkedAt: new Date(), missingArtifacts: [] };
    }

    const nodeConfig = flowDef.nodesConfig.find(
      (nc) => nc.nodeId === execution.nodeId,
    );
    if (!nodeConfig) {
      this.logger.warn(
        `门禁校验：找不到节点配置 nodeId=${execution.nodeId}，默认通过`,
      );
      return { pass: true, checkedAt: new Date(), missingArtifacts: [] };
    }

    // 仅校验 required=true 的输出物
    const requiredArtifacts = nodeConfig.requiredArtifacts.filter(
      (ar) => ar.required,
    );

    if (requiredArtifacts.length === 0) {
      this.logger.log(
        `门禁校验：节点 ${execution.nodeId} 无必需输出物，直接通过`,
      );
      return { pass: true, checkedAt: new Date(), missingArtifacts: [] };
    }

    // 获取已绑定的平台内文档（架构约束：外链不计入门禁）
    const bindings = [...this.store.artifactBindings.values()].filter(
      (b) => b.nodeExecutionId === execution.id && !!b.documentId,
    );
    const boundRequirementIds = new Set(bindings.map((b) => b.requirementId));

    // 计算缺失项
    const missingArtifacts: MissingArtifact[] = requiredArtifacts
      .filter((ar) => !boundRequirementIds.has(ar.id))
      .map((ar) => ({ requirementId: ar.id, name: ar.name }));

    const pass = missingArtifacts.length === 0;

    this.logger.log(
      `门禁校验完成: executionId=${execution.id} nodeId=${execution.nodeId} pass=${pass} missing=${missingArtifacts.length}`,
    );

    return { pass, checkedAt: new Date(), missingArtifacts };
  }
}
