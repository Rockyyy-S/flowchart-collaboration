---
applyTo: "docs/**"
name: "文档产出规范"
description: "适用于 docs/ 目录下所有产出文档（需求、架构、测试报告、安全审查、发布记录、运维手册）的格式规范。"
---

# 文档产出规范

## 1. 目录结构约定

```
docs/
├── context/          # Context Doc（项目状态跟踪，每个项目一个文件）
├── requirements/     # 需求文档（产品规划官产出）
├── architecture/     # 架构设计文档（架构设计师产出）
├── implementation/   # 实现摘要（前端/后端专家产出）
├── qa/               # 测试报告（QA 专家产出）
├── security/         # 安全审查报告（安全审查师产出）
├── ops/              # 运维手册（运维工程师产出）
├── releases/         # 发布记录（发布经理产出）
└── user-docs/        # 用户与 API 文档（文档撰写员产出）
```

## 2. 文件命名规范

| 角色 | 文件名模式 | 示例 |
|-----|---------|------|
| 产品规划官 | `{功能名}-prd.md` | `user-auth-prd.md` |
| 架构设计师 | `{项目名}-architecture.md` | `user-auth-architecture.md` |
| 后端专家 | `{功能名}-backend-summary.md` | `user-auth-backend-summary.md` |
| 前端专家 | `{功能名}-frontend-summary.md` | `user-auth-frontend-summary.md` |
| QA 专家 | `{功能名}-test-report.md` | `user-auth-test-report.md` |
| 安全审查师 | `{变更范围}-security-review.md` | `auth-api-security-review.md` |
| 运维工程师 | `{版本/环境}-deploy-runbook.md` | `v1.2.0-prod-deploy-runbook.md` |
| 发布经理 | `{版本号}-release-note.md` | `v1.2.0-release-note.md` |
| 文档撰写员 | `{功能名}-user-guide.md` 或 `{功能名}-api-doc.md` | — |

## 3. 必须包含字段（按角色）

所有文档必须包含文件头：
```markdown
# 文档标题
> 版本：vX | 日期：YYYY-MM-DD | 负责角色：XXX | 状态：草稿/已审核/已归档
```

### Context Doc（.../context/）
必须包含：元信息、阶段状态表、质量门禁状态、阻塞与风险记录、版本历史。

### 测试报告（.../qa/）
必须包含：测试范围、测试结果与缺陷清单、放行建议（✅/❌）、回归计划。

### 安全审查报告（.../security/）
必须包含：风险摘要、漏洞清单与 CVSS 定级、修复建议与优先级、放行意见（✅/❌）。

### 发布记录（.../releases/）
必须包含：放行结论、上线步骤与回滚清单、责任人、发布后观察项。

## 4. 文档落盘原则

- 不得以"聊天输出替代文档落盘"；每个阶段的关键产出必须写入对应 `docs/` 子目录。
- 文件存在时追加版本内容，不覆盖历史记录。
- 阻塞/风险必须写入 Context Doc 的 `## 阻塞与风险记录` 节，不仅是口头提醒。
- 所有文档默认使用**简体中文**；术语可保留必要英文（如 API、CI/CD、MCP）。

## 5. 禁止行为

- 禁止在测试报告/安全报告中省略 ✅ 或 ❌ 放行状态——这是阶段门禁依据。
- 禁止多个角色写入同一文件而不追加版本标记。
- 禁止将"待执行（需人工或 MCP 执行）"标注的任务改为"已完成"。
