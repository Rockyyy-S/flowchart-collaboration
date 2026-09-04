/**
 * 节点命名工具函数
 * 提供语义化、可读的节点ID生成能力
 */

/**
 * 简单汉字转拼音映射（常见字符）
 * 生产环境建议使用 pinyin 库：npm install pinyin
 * 为了避免第三方依赖，这里提供基础映射和降级方案
 */
// 汉字转拼音映射表（常见字符）
// 为了支持中文节点名称生成语义化 ID，提供基础拼音映射
// 字符排序以避免重复，生产环境建议使用专业拼音库
const PINYIN_MAP: Record<string, string> = {
  // 常见动词
  用: 'yong',
  做: 'zuo',
  处: 'chu',
  理: 'li',
  删: 'shan',
  除: 'chu',
  编: 'bian',
  辑: 'ji',
  设: 'she',
  置: 'zhi',
  配: 'pei',
  反: 'fan',
  发: 'fa',
  测: 'ce',
  试: 'shi',
  审: 'shen',
  核: 'he',
  生: 'sheng',
  成: 'cheng',
  开: 'kai',
  启: 'qi',
  结: 'jie',
  束: 'shu',
  
  // 常见名词
  户: 'hu',
  馈: 'kui',
  部: 'bu',
  署: 'shu',
  任: 'ren',
  务: 'wu',
  流: 'liu',
  程: 'cheng',
  子: 'zi',
  质: 'zhi',
  量: 'liang',
  评: 'ping',
  优: 'you',
  化: 'hua',
  布: 'bu',
  
  // 其他常见字
  分: 'fen',
  端: 'duan',
  点: 'dian',
  段: 'duan',
  完: 'wan',
};

/**
 * 将汉字转换为拼音（基础降级方案）
 * 注意：这只是简单映射，复杂字符可能转换不准确
 * 生产环境建议使用专业拼音库
 * @param char 单个汉字
 * @returns 拼音或空字符串（如果无法识别）
 */
function charToPinyin(char: string): string {
  return PINYIN_MAP[char] || '';
}

/**
 * 将节点名称转换为 slug 格式
 * 
 * 处理规则：
 * - 英文：转小写
 * - 中文：转拼音（基础映射）
 * - 特殊字符：删除
 * - 空格/连字符：转下划线
 * 
 * @param name 节点名称
 * @returns 标准化的 slug 字符串（仅包含小写字母、数字、下划线）
 * 
 * @example
 * slugifyNodeName('DEV') // 'dev'
 * slugifyNodeName('QA Test') // 'qa_test'
 * slugifyNodeName('用户反馈') // 'yonghu_fanku'
 */
export function slugifyNodeName(name: string): string {
  if (!name || name.trim().length === 0) {
    return 'node';
  }

  let result = '';

  for (const char of name) {
    if (/[a-zA-Z0-9]/.test(char)) {
      // 英文字母或数字：转小写
      result += char.toLowerCase();
    } else if (/[\s_-]/.test(char)) {
      // 空格、下划线、连字符：转下划线
      // 避免重复下划线
      if (result && !result.endsWith('_')) {
        result += '_';
      }
    } else if (/[\u4e00-\u9fff]/.test(char)) {
      // 中文字符：转拼音
      const pinyin = charToPinyin(char);
      if (pinyin) {
        if (result && !result.endsWith('_')) {
          result += '_';
        }
        result += pinyin;
      }
    }
    // 其他特殊字符忽略
  }

  // 移除末尾下划线
  result = result.replace(/_+$/, '');
  // 替换多个连续下划线为单个
  result = result.replace(/_+/g, '_');

  return result || 'node';
}

/**
 * 生成语义化的节点ID
 * 格式：node_{slugified_name}_{unique_suffix}
 * 
 * 说明：
 * - 始终追加唯一后缀，确保符合“前缀_唯一id”规则。
 * - 唯一后缀使用时间戳 + 随机串，若仍冲突则继续重试。
 * 
 * @param name 节点名称
 * @param existingNodeIds 现有所有节点ID集合（用于检测重复）
 * @returns 唯一的节点ID
 * 
 * @example
 * generateNodeId('DEV', new Set()) // 'node_dev_lm2xk9ab3f'
 */
export function generateNodeId(name: string, existingNodeIds: Set<string>): string {
  const slug = slugifyNodeName(name);
  const baseId = `node_${slug}`;

  let attempt = 0;
  while (attempt < 6) {
    const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const candidateId = `${baseId}_${uniqueSuffix}`;
    if (!existingNodeIds.has(candidateId)) {
      return candidateId;
    }
    attempt += 1;
  }

  // 理论上不会触发；兜底保证返回值稳定且唯一。
  return `${baseId}_${Date.now().toString(36)}_fallback`;
}

/**
 * 从现有节点列表构建ID集合
 * @param nodes 节点数组（包含 id 属性）
 * @returns ID集合
 */
export function buildNodeIdSet(nodes: Array<{ id: string }>): Set<string> {
  return new Set(nodes.map((n) => n.id));
}
