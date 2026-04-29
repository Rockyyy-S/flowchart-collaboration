import { IsString, IsNotEmpty } from 'class-validator';

/** 拒绝/回退请求体 */
export class RejectExecutionDto {
  /**
   * 当前调用者所在的节点 ID（下一个节点的 nodeId）
   * 调用者必须是该节点的 assignees 成员
   */
  @IsString()
  @IsNotEmpty()
  nextNodeId: string;

  /** 拒绝理由（必填） */
  @IsString()
  @IsNotEmpty()
  reason: string;
}
