import { v4 as uuidv4 } from 'uuid';

/**
 * 生成带前缀的短 ID
 * 格式：{prefix}{uuid前8位（去连字符）}
 * 示例：team-a1b2c3d4, project-e5f6g7h8, flowchart-i9j0k1l2
 *
 * @param prefix 实体类型前缀，如 'team-', 'project-', 'flowchart-', 'node-'
 */
export function generateId(prefix: string): string {
  const raw = uuidv4().replace(/-/g, '');
  return `${prefix}${raw.substring(0, 8)}`;
}
