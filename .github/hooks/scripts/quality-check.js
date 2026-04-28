#!/usr/bin/env node
/**
 * quality-gate: PostToolUse Hook
 *
 * 接收 stdin 中的工具调用结果（JSON），校验写入文件的格式与结构。
 * - exit 0   = 质量通过
 * - exit 2   = 发现问题 + 输出 systemMessage（要求角色按规则修正后重写）
 *
 * 校验规则：
 *  1. `.github/agents/*.agent.md` 必须含有 YAML frontmatter（--- 开头）
 *  2. `.github/prompts/*.prompt.md` 必须含有 YAML frontmatter
 *  3. `.github/hooks/*.json` 必须是有效 JSON
 *  4. `docs/` 下的 .md 文件必须含有一级标题（# 开头的行）
 *  5. 常见代码文件必须包含注释；复杂逻辑需补充详细注释（由人工评审确认充分性）
 *  6. 启发式复杂度检查：当代码复杂度较高且注释密度/解释性不足时阻断
 */

const fs = require('fs');
const path = require('path');

const COMMENT_REQUIRED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.sh', '.bash', '.zsh', '.rb',
  '.java', '.go', '.rs', '.php', '.swift', '.kt',
  '.c', '.cc', '.cpp', '.h', '.hpp', '.cs',
  '.sql', '.html', '.xml', '.vue', '.css', '.scss', '.less'
]);

const COMPLEXITY_CHECK_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.sh', '.bash', '.zsh', '.rb',
  '.java', '.go', '.rs', '.php', '.swift', '.kt',
  '.c', '.cc', '.cpp', '.h', '.hpp', '.cs'
]);

const DETAILED_COMMENT_MARKERS = [
  '原因', '为什么', '边界', '异常', '兜底', '重试', '回退', '并发', '状态', '风险', '兼容',
  'because', 'why', 'edge case', 'fallback', 'retry', 'concurrency', 'trade-off', 'rationale'
];

function isCodeFileRequiringComment(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return COMMENT_REQUIRED_EXTENSIONS.has(ext);
}

function hasComment(content, ext) {
  // 这里仅做“存在性”检查，复杂逻辑注释充分性由角色评审与人工门禁确认。
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.java', '.go', '.rs', '.php', '.swift', '.kt', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.css', '.scss', '.less'].includes(ext)) {
    return /(^|\n)\s*\/\/|\/\*[\s\S]*?\*\//.test(content);
  }

  if (['.py', '.sh', '.bash', '.zsh', '.rb'].includes(ext)) {
    return /(^|\n)\s*#(?!\!)/.test(content);
  }

  if (['.sql'].includes(ext)) {
    return /(^|\n)\s*--|\/\*[\s\S]*?\*\//.test(content);
  }

  if (['.html', '.xml', '.vue'].includes(ext)) {
    return /<!--[\s\S]*?-->/.test(content);
  }

  return false;
}

function isComplexityCheckFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return COMPLEXITY_CHECK_EXTENSIONS.has(ext);
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function stripComments(content, ext) {
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.java', '.go', '.rs', '.php', '.swift', '.kt', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs'].includes(ext)) {
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '\n')
      .replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '\n');
  }

  if (['.py', '.sh', '.bash', '.zsh', '.rb'].includes(ext)) {
    return content.replace(/(^|\n)\s*#(?!\!).*(?=\n|$)/g, '\n');
  }

  return content;
}

function extractComments(content, ext) {
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.java', '.go', '.rs', '.php', '.swift', '.kt', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs'].includes(ext)) {
    const lineComments = content.match(/(^|\n)\s*\/\/.*(?=\n|$)/g) || [];
    const blockComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
    return lineComments.concat(blockComments).join('\n');
  }

  if (['.py', '.sh', '.bash', '.zsh', '.rb'].includes(ext)) {
    const hashComments = content.match(/(^|\n)\s*#(?!\!).*(?=\n|$)/g) || [];
    return hashComments.join('\n');
  }

  return '';
}

function estimateComplexityScore(contentWithoutComments) {
  let score = 0;

  score += countMatches(contentWithoutComments, /\bif\b|\belse\s+if\b|\belse\b|\bswitch\b|\bcase\b|\bwhen\b/g);
  score += countMatches(contentWithoutComments, /\bfor\b|\bwhile\b|\bdo\b|\bforeach\b/g);
  score += countMatches(contentWithoutComments, /\btry\b|\bcatch\b|\bfinally\b|\bexcept\b|\brescue\b/g) * 2;
  score += countMatches(contentWithoutComments, /&&|\|\||\?/g);
  score += countMatches(contentWithoutComments, /\basync\b|\bawait\b|\bpromise\b|\bconcurrent\b|\bmutex\b|\block\b|\bthread\b/gi) * 2;

  return score;
}

function countCommentLines(commentText) {
  return commentText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .length;
}

function hasDetailedCommentMarker(commentText) {
  const lowered = commentText.toLowerCase();
  return DETAILED_COMMENT_MARKERS.some((marker) => lowered.includes(marker));
}

function validateComplexLogicCommentDensity(content, ext) {
  const contentWithoutComments = stripComments(content, ext);
  const complexityScore = estimateComplexityScore(contentWithoutComments);
  if (complexityScore < 8) {
    return [];
  }

  const issues = [];
  const commentText = extractComments(content, ext);
  const commentLineCount = countCommentLines(commentText);
  const hasDetailedMarkers = hasDetailedCommentMarker(commentText);

  if (commentLineCount < 2) {
    issues.push(`复杂逻辑注释密度不足（复杂度=${complexityScore}，建议至少 2 行有效注释）`);
  }

  if (complexityScore >= 12 && !hasDetailedMarkers) {
    issues.push(`复杂逻辑缺少解释性注释（复杂度=${complexityScore}，需说明原因/边界/兜底或 trade-off）`);
  }

  return issues;
}

function collectTargetFiles(event) {
  const toolName = event.tool_name || '';
  const input = event.input || {};

  // 优先处理 apply_patch：从补丁文本中提取目标文件
  if (toolName === 'apply_patch' && typeof input.input === 'string') {
    const files = [];
    const regex = /\*\*\*\s+(?:Add|Update)\s+File:\s+(.+)/g;
    let match;
    while ((match = regex.exec(input.input)) !== null) {
      const rawPath = match[1].trim();
      const normalized = path.normalize(rawPath);
      files.push(normalized);
    }
    return files;
  }

  // 其他写操作工具尽量从 filePath/path 提取目标
  const filePath = input.filePath || input.path;
  if (typeof filePath === 'string' && filePath.trim()) {
    return [path.normalize(filePath.trim())];
  }

  return [];
}

function validateFile(filePath) {
  // 文件不存在则跳过（可能是删除操作）
  if (!fs.existsSync(filePath)) return [];

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // 规则 1+2: agent/prompt .md 文件必须有 YAML frontmatter
  if (/\.github[/\\](agents|prompts)[/\\].+\.(agent|prompt)\.md$/.test(filePath)) {
    if (!content.trimStart().startsWith('---')) {
      issues.push('缺少 YAML frontmatter（文件必须以 --- 开头）');
    }
  }

  // 规则 3: hooks/*.json 必须是有效 JSON
  if (/\.github[/\\]hooks[/\\].+\.json$/.test(filePath)) {
    try {
      JSON.parse(content);
    } catch (e) {
      issues.push(`JSON 格式无效：${e.message}`);
    }
  }

  // 规则 4: docs/ 下的 .md 文件必须有一级标题
  if (/[/\\]docs[/\\].+\.md$/.test(filePath) && !/^#\s/.test(content) && !content.includes('\n# ')) {
    issues.push('docs/ 文档缺少一级标题（第一行须为 # 标题）');
  }

  // 规则 5: 常见代码文件必须包含注释
  const ext = path.extname(filePath).toLowerCase();
  if (isCodeFileRequiringComment(filePath) && !hasComment(content, ext)) {
    issues.push('代码文件缺少注释（每次写代码必须写注释；复杂逻辑需详细注释）');
  }

  // 规则 6: 启发式复杂度检查，复杂代码必须有更充分注释
  if (isComplexityCheckFile(filePath)) {
    issues.push(...validateComplexLogicCommentDensity(content, ext));
  }

  return issues;
}

let rawInput = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { rawInput += chunk; });
process.stdin.on('end', () => {
  let event;
  try {
    event = JSON.parse(rawInput);
  } catch {
    process.exit(0);
  }

  const targetFiles = collectTargetFiles(event);
  if (targetFiles.length === 0) process.exit(0);

  const issueLines = [];
  for (const filePath of targetFiles) {
    const issues = validateFile(filePath);
    for (const issue of issues) {
      issueLines.push(`  - [${filePath}] ${issue}`);
    }
  }

  if (issueLines.length > 0) {
    process.stdout.write(
      'quality-gate ⚠️ 文件质量检查未通过：\n' +
      issueLines.join('\n') + '\n' +
      '请按以上问题修正文件后重新写入。'
    );
    process.exit(2);
  }

  process.exit(0);
});
