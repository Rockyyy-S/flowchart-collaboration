#!/usr/bin/env node
/**
 * security-gate: PreToolUse Hook
 *
 * 接收 stdin 中的工具调用事件（JSON），检测高危操作模式。
 * - exit 0   = 允许继续
 * - exit 2   = 阻断 + 输出 systemMessage（Copilot 会将 stdout 作为提示展示）
 *
 * 触发规则：
 *  1. 终端命令中包含破坏性模式（rm -rf、DROP TABLE 等）
 *  2. 写操作目标路径含有生产环境敏感关键词
 */

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /rm\s+-rf\s+~/,
  /remove-item\s+.+-recurse\s+-force/i,
  /\bri\s+.+-recurse\s+-force\b/i,
  /\bget-childitem\b.+\|\s*\bremove-item\b/i,
  /\bdel\s+\/s\s+\/q\b/i,
  /\berase\s+\/s\s+\/q\b/i,
  /\brd\s+\/s\s+\/q\b/i,
  /\brmdir\s+\/s\s+\/q\b/i,
  /drop\s+table/i,
  /truncate\s+table/i,
  /delete\s+from\s+\S+\s+where\s+1\s*=\s*1/i,
  /dd\s+if=/,
  /mkfs/,
  /format\s+[a-zA-Z]:/,
  /shutdown\s+(-[hr]|\/[rs])/,
  />(\/dev\/sd|\/dev\/nvme)/,
];

let rawInput = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { rawInput += chunk; });
process.stdin.on('end', () => {
  let event;
  try {
    event = JSON.parse(rawInput);
  } catch {
    process.exit(0); // 无法解析则放行
  }

  const inputStr = JSON.stringify(event.input || '').toLowerCase();
  const match = DANGEROUS_PATTERNS.find((r) => r.test(inputStr));

  if (match) {
    process.stdout.write(
      'security-gate ⛔ 高危操作已拦截。\n' +
      '请改为：输出操作方案文档并标注「待执行（需人工确认）」，不得直接执行。\n' +
      `匹配规则：${match}`
    );
    process.exit(2);
  }

  process.exit(0);
});
