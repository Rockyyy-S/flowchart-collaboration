import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { NODE_ID_PATTERN } from '../../common/constants/validation-patterns';

/** 拒绝/回退请求体 */
export class RejectExecutionDto {
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

  /** 拒绝理由（必填） */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
