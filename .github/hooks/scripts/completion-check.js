#!/usr/bin/env node
/**
 * completion-gate: Stop / SubagentStop Hook
 *
 * 在代理（或子代理）结束前，执行两类检查：
 * 1) context doc 质量门禁状态是否仍为待完成
 * 2) 协调员结束前，todo-list 是否仍有可执行待办
 * - exit 0   = 门禁全部已更新，允许结束
 * - exit 2   = 发现未更新的门禁状态，阻止结束并输出提示
 *
 * 检测逻辑：
 *  [context doc]
 *  优先读取当前会话显式传入的 context-doc 路径；若不存在则回退到 recent 文件；
 *  若 recent 为空则检查最新修改的 context 文档，避免长会话漏检。
 *  若门禁行仍含 ⏳（含"质量门禁"、"安全放行"或"发布后观察"关键词），则阻断。
 *
 *  [todo-list]
 *  仅当当前角色是项目总协调时启用：
 *  - 若存在未完成且非阻塞项，则阻断结束（应继续自动分流）
 *  - 若仅剩阻塞项，则阻断结束并提示阻塞
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const CONTEXT_DIR = path.resolve(__dirname, '..', '..', '..', 'docs', 'context');
const TODO_LIST_FILE = path.resolve(PROJECT_ROOT, 'todo-list.md');
const GATE_KEYWORDS = ['质量门禁', '安全放行', '发布门禁', '发布后观察'];
const PENDING_SYMBOL = '⏳';
const RECENT_WINDOW_MS = 30 * 60 * 1000; // 30 分钟内

function getExplicitContextDoc() {
  const envCandidates = [
    process.env.CONTEXT_DOC,
    process.env.CONTEXT_DOC_PATH,
    process.env.COPILOT_CONTEXT_DOC,
    process.env.COPILOT_CONTEXT_DOC_PATH,
    process.env.CURRENT_CONTEXT_DOC,
  ].filter(Boolean);

  for (const candidate of envCandidates) {
    const value = String(candidate).trim();
    if (!value) continue;

    const fullPath = path.isAbsolute(value)
      ? value
      : path.resolve(PROJECT_ROOT, value);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }

  return null;
}

function collectContextFilesToCheck() {
  if (!fs.existsSync(CONTEXT_DIR)) return [];

  const explicit = getExplicitContextDoc();
  if (explicit) return [explicit];

  const files = fs.readdirSync(CONTEXT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({
      file: f,
      fullPath: path.join(CONTEXT_DIR, f),
      mtimeMs: fs.statSync(path.join(CONTEXT_DIR, f)).mtimeMs,
    }));

  if (files.length === 0) return [];

  const now = Date.now();
  const recent = files.filter((f) => now - f.mtimeMs <= RECENT_WINDOW_MS);
  if (recent.length > 0) return recent.map((f) => f.fullPath);

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return [files[0].fullPath];
}

function isCoordinatorRole() {
  const candidates = [
    process.env.COPILOT_AGENT_NAME,
    process.env.AGENT_NAME,
    process.env.AGENT,
    process.env.ROLE_NAME,
    process.env.COPILOT_ROLE,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!candidates) return false;

  return (
    candidates.includes('项目总协调') ||
    candidates.includes('project coordinator') ||
    candidates.includes('coordinator')
  );
}

function parseTodoList(content) {
  const lines = content.split('\n');
  let actionable = 0;
  let blocked = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('- [ ]')) continue;

    const isBlocked = /\[blocked\]|阻塞|⛔/i.test(line);
    if (isBlocked) {
      blocked += 1;
    } else {
      actionable += 1;
    }
  }

  return { actionable, blocked };
}

const pending = [];

const contextFilesToCheck = collectContextFilesToCheck();
for (const filePath of contextFilesToCheck) {
  const file = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    const hasKeyword = GATE_KEYWORDS.some((k) => line.includes(k));
    if (hasKeyword && line.includes(PENDING_SYMBOL)) {
      pending.push({ file, line: line.trim() });
    }
  }
}

if (pending.length > 0) {
  const details = pending.map((p) => `  [${p.file}] ${p.line}`).join('\n');
  process.stdout.write(
    'completion-gate ⛔ 检测到 context doc 门禁状态未更新，不允许结束。\n' +
    '以下门禁项仍为 ⏳（待完成）：\n' +
    details + '\n\n' +
    '请完成对应门禁状态的更新（将 ⏳ 改为 ✅ 或 ❌）后再结束。'
  );
  process.exit(2);
}

if (isCoordinatorRole() && fs.existsSync(TODO_LIST_FILE)) {
  const todoContent = fs.readFileSync(TODO_LIST_FILE, 'utf8');
  const todoStats = parseTodoList(todoContent);

  if (todoStats.actionable > 0) {
    process.stdout.write(
      'completion-gate ⛔ 检测到 todo-list.md 仍有未完成且非阻塞项，不允许结束。\n' +
      `未完成可执行项数量：${todoStats.actionable}\n` +
      '请继续自动分流执行下一轮任务。'
    );
    process.exit(2);
  }

  if (todoStats.blocked > 0) {
    process.stdout.write(
      'completion-gate ⛔ 检测到 todo-list.md 仅剩阻塞项，不允许直接结束。\n' +
      `阻塞项数量：${todoStats.blocked}\n` +
      '请先输出阻塞原因、影响范围与解除条件。'
    );
    process.exit(2);
  }
}

process.exit(0);
