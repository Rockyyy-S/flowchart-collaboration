import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { NODE_ID_PATTERN } from '../../common/constants/validation-patterns';

/** 审核通过请求体 */
export class ApproveExecutionDto {
  /**
   * 当前调用者所在的节点 ID（下一个节点的 nodeId）
   * 调用者必须是该节点的 assignees 成员
   */
  @IsString()
  @IsNotEmpty()
  @Matches(NODE_ID_PATTERN, {
    message: 'nextNodeId 格式不合法',
  })
  nextNodeId: string;
}
