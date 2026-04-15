#!/usr/bin/env node
/**
 * quality-gate: PostToolUse Hook
 *
 * 接收 stdin 中的工具调用结果（JSON），校验写入文件的格式与结构。
 * - exit 0   = 质量通过
 * - exit 2   = 发现问题 + 输出 systemMessage（要求角色按规则修正后重写）
 *
 * 校验规则（.md 文件）：
 *  1. `.github/agents/*.agent.md` 必须含有 YAML frontmatter（--- 开头）
 *  2. `.github/prompts/*.prompt.md` 必须含有 YAML frontmatter
 *  3. `.github/hooks/*.json` 必须是有效 JSON
 *  4. `docs/` 下的 .md 文件必须含有一级标题（# 开头的行）
 */

const fs = require('fs');
const path = require('path');

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
