---
applyTo: ".github/**"
name: "工作流配置规范"
description: "适用于 .github 目录下所有配置文件（agents、instructions、prompts、skills、hooks、mcp）的统一规范。"
---

# 工作流配置文件规范

## 1. 文件命名约定

| 组件类型 | 路径 | 文件名格式 | 示例 |
|---------|------|----------|------|
| 全局指令 | `.github/` | `copilot-instructions.md` | 固定 |
| 分域指令 | `.github/instructions/` | `{主题}.instructions.md` | `workflow-config.instructions.md` |
| 提示词 | `.github/prompts/` | `{名称}.prompt.md` | `refactor.prompt.md` |
| 角色代理 | `.github/agents/` | `{角色}.agent.md` | `qa-specialist.agent.md` |
| 技能包 | `.github/skills/{技能名}/` | `SKILL.md`（固定） | `SKILL.md` |
| 钩子 | `.github/hooks/` | `{用途}.json` | `security-gate.json` |

## 2. YAML Frontmatter 必填字段

### agents（`.agent.md`）
```yaml
---
name: "显示名称"
description: "一句话描述，包含：是什么角色、适用何种任务。"
tools: [read, search, edit]    # 最小权限原则
argument-hint: "调用时的提示文字"
user-invocable: true           # false 表示只作为 subagent
handoffs:                      # 至少定义一个下游交接
  - label: "to_xxx"
    agent: "下游角色名"
    prompt: "交接时的上下文说明"
---
```

### instructions（`.instructions.md`）
```yaml
---
applyTo: "glob 模式"
name: "规则显示名"
description: "适用场景说明"
---
```

### prompts（`.prompt.md`）
```yaml
---
description: "一句话任务描述"
agent: agent                   # 默认 agent；只读任务用 ask
tools: [read, search]          # 该 prompt 允许的最小工具集
---
```

### skills（`SKILL.md`）
```yaml
---
name: skill-name               # 小写+连字符，必须与目录名一致
description: "描述 + 何时触发。字符数 < 1024。"
---
```

## 3. tools 最小权限原则

| 角色/组件类型 | 可选工具集 | 说明 |
|-------------|---------|------|
| 只读分析角色 | `[read, search]` | 禁止 edit/run |
| 执行实现角色 | `[read, search, edit]` | 禁止 run（除非有 shell 需求） |
| 协调调度角色 | `[read, search, agent, todo]` | 禁止直接 edit 业务代码 |
| 写报告审查角色 | `[read, search, edit]` | edit 仅用于文档落盘 |
| Prompt 只读任务 | `[read, search]` | — |

## 4. handoff 同步点要求

每个 agent 的 handoff 必须:
1. 至少包含 **一个"失败/阻塞时"的回传路径**（回传 `项目总协调`）。
2. prompt 字段必须说明**上下文注入字段**：`context-doc:` 路径 + 本阶段关键产出。
3. 涉及门禁角色（QA、安全）的跨越交接，必须显式等待门禁状态为 ✅ 才可继续。

## 5. 禁止行为

- 禁止在一个 `instructions` 文件中混用"策略偏好"与"强制拦截"逻辑（后者属于 hooks）。
- 禁止 `applyTo: "**"` 的指令文件包含角色专属规则（会污染全局上下文）。
- 禁止在 skills 中内嵌本应通过 hooks 强制执行的安全检查（hooks 保障确定性，skills 只做指导）。
- 禁止在 prompt 中指定超出任务必要范围的 tools（过度权限导致误操作风险）。

## 6. todo-list 递归执行规范

- 根目录 `todo-list.md` 作为协调员续跑清单，默认文件位置为项目根目录。
- 清单最小格式建议使用 Markdown checkbox：
  - `- [ ] {待办}` 表示未完成可执行项
  - `- [x] {待办}` 表示已完成项
  - 含 `[BLOCKED]` 或 `阻塞` 标记的待办视为阻塞项
- 仅协调调度角色负责递归推进清单：执行角色不得自行触发下一轮续跑。
- 协调员在每轮结束前必须检查 `todo-list.md`：
  - 存在未完成且非阻塞项：继续分流执行
  - 仅剩阻塞项：停止并上报阻塞
  - 文件不存在或无待办：允许结束
