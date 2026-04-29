/**
 * 节点执行状态枚举
 * 与前端状态机枚举保持一致，由此文件作为单一来源（前端通过 OpenAPI 生成类型）
 */
export enum ExecutionStatus {
  /** 待启动：前置节点未全部完成 */
  PENDING = 'PENDING',
  /** 可开始：前置节点全部完成，等待执行人点击开始 */
  READY = 'READY',
  /** 进行中：执行人已点击开始 */
  IN_PROGRESS = 'IN_PROGRESS',
  /** 门禁检查中：执行人已提交，系统正在校验输出物 */
  GATE_CHECKING = 'GATE_CHECKING',
  /** 已完成：门禁通过 */
  COMPLETED = 'COMPLETED',
  /** 待补齐：门禁失败，等待执行人补充输出物后重新提交 */
  NEEDS_FIX = 'NEEDS_FIX',
  /** 被拒绝：下个节点参与者审核不通过，流程回退到当前节点 */
  REJECTED = 'REJECTED',
}

/**
 * 合法的状态迁移映射表
 * 任何状态变更都必须经过此表校验，禁止跳跃迁移
 */
export const VALID_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  [ExecutionStatus.PENDING]: [ExecutionStatus.READY],
  [ExecutionStatus.READY]: [ExecutionStatus.IN_PROGRESS],
  [ExecutionStatus.IN_PROGRESS]: [ExecutionStatus.GATE_CHECKING],
  [ExecutionStatus.GATE_CHECKING]: [
    ExecutionStatus.COMPLETED,
    ExecutionStatus.NEEDS_FIX,
  ],
  [ExecutionStatus.NEEDS_FIX]: [ExecutionStatus.IN_PROGRESS],
  // 已完成 → 被拒绝（下个节点参与者审核不通过）
  [ExecutionStatus.COMPLETED]: [ExecutionStatus.REJECTED],
  // 被拒绝 → 重新进行（返工重做，类似 NEEDS_FIX 语义）
  [ExecutionStatus.REJECTED]: [ExecutionStatus.IN_PROGRESS],
};

/** 判断状态迁移是否合法 */
export function isValidTransition(
  from: ExecutionStatus,
  to: ExecutionStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
