import { IsString, IsNotEmpty } from 'class-validator';

/** 审核通过请求体 */
export class ApproveExecutionDto {
  /**
   * 当前调用者所在的节点 ID（下一个节点的 nodeId）
   * 调用者必须是该节点的 assignees 成员
   */
  @IsString()
  @IsNotEmpty()
  nextNodeId: string;
}
