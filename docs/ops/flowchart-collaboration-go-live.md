# flowchart-collaboration 上线管理文档（Go-Live Runbook）

> 版本：v1.0 | 日期：2026-05-01 | 负责角色：文档撰写员 | 状态：已审核

## 1. 发布前检查清单（Pre-Go-Live Checklist）

本节用于发布窗口开始前 T-24h 至 T-1h 的最终确认，任何阻塞项未关闭时不得进入上线阶段。

### 1.1 功能验收

| 项目 | 验收标准 | 验证方式 | 当前口径 |
|---|---|---|---|
| 核心流程闭环 | 创建项目 -> 启动节点 -> 提交 -> 门禁结果可见 | API + UI 联调 | 需补齐运行时证据 |
| 流程编辑能力 | 新增/删除/连线/保存草稿无阻塞 | Playwright + 手测 | 已完成代码级验证 |
| 权限链路 | 非成员 403、无 token 401 | curl 场景验证 | 文档中已有脚本 |
| 健康检查 | /api/v1/health 可用 | curl/监控探针 | 已具备 |

Playwright 通过率门槛（建议）：

- smoke 场景：100%
- 核心场景：>= 95%
- 若低于阈值，必须评审是否推迟发布。

### 1.2 性能基准

| 指标 | 目标 | 触发阻塞条件 |
|---|---|---|
| API P95 响应时间 | <= 800ms | 连续 10 分钟 > 1200ms |
| API 5xx 错误率 | < 1% | 连续 10 分钟 >= 2% |
| 核心吞吐 | >= 50 RPS（MVP 单机参考） | 压测低于 30 RPS 且 CPU 打满 |

### 1.3 安全审查

发布前必须确认：

- 安全门禁为通过状态（见安全审查报告）。
- JWT 密钥、刷新密钥已替换为生产值。
- CORS 白名单已改为线上域名，未保留 localhost。

参考：

- [docs/security/flowchart-collaboration-security-review.md](../security/flowchart-collaboration-security-review.md)

### 1.4 数据准备

| 项目 | 要求 |
|---|---|
| 初始管理员账号 | 已创建并验证登录 |
| 初始团队与示例项目 | 至少 1 个可演示项目 |
| 运维账号权限 | 发布、回滚、日志查看权限齐全 |

### 1.5 文档完整性

发布前文档检查：

- 用户指南：[docs/user-docs/flowchart-collaboration-user-guide.md](../user-docs/flowchart-collaboration-user-guide.md)
- 部署指南：[docs/ops/flowchart-collaboration-deployment.md](./flowchart-collaboration-deployment.md)
- 维护手册：[docs/ops/flowchart-collaboration-maintenance-runbook.md](./flowchart-collaboration-maintenance-runbook.md)
- 发布记录：[docs/releases/v0.1.0-release-note.md](../releases/v0.1.0-release-note.md)

## 2. 版本管理

### 2.1 版本号规范（Semantic Versioning）

格式：MAJOR.MINOR.PATCH

- MAJOR：不兼容变更
- MINOR：向后兼容的新功能
- PATCH：向后兼容的问题修复

示例：

- v0.1.0：MVP 首版
- v0.1.1：热修复
- v0.2.0：新增可选模块但兼容原接口

### 2.2 版本发布流程

1. 从主分支切发布分支（release/x.y.z）。
2. 冻结变更并完成 QA + 安全门禁确认。
3. 打 Tag 并生成发布说明。
4. 执行灰度发布并持续观察。
5. 达标后全量，补齐发布总结。

### 2.3 变更日志指针（CHANGELOG）

当前仓库尚未创建根目录 CHANGELOG.md，建议新增并按版本追踪。

临时追溯入口：

- [docs/releases/v0.1.0-release-note.md](../releases/v0.1.0-release-note.md)
- [docs/context/flowchart-collaboration-context.md](../context/flowchart-collaboration-context.md)

## 3. 上线窗口规划

### 3.1 时间表示例

| 时间点 | 动作 | 责任角色 |
|---|---|---|
| T-24h | 发布清单冻结、值守排班确认 | 发布经理 |
| T-4h | 备份、环境变量复核、告警静默策略确认 | 运维工程师 |
| T-1h | 最终 Go/No-Go 评审 | 发布经理 + QA + 安全 |
| T0 | Phase 1 后端上线 | 运维工程师/后端专家 |
| T0+30m | Phase 2 前端上线 | 运维工程师/前端专家 |
| T0+2h | 业务验收与观测复核 | QA/产品/发布经理 |

### 3.2 参与角色与职责

| 角色 | 职责 | 阻塞权 |
|---|---|---|
| 发布经理 | 节奏控制、Go/No-Go 决策 | 有 |
| 运维工程师 | 部署与回滚执行、监控看板 | 有 |
| QA 专家 | 验收与发布后回归 | 有 |
| 安全审查师 | 安全告警与风险判定 | 有 |
| 前后端专家 | 技术排障与热修复支持 | 无（建议权） |

### 3.3 通信协议

- 发布群状态更新频率：每 15 分钟一次。
- 关键阶段切换（Phase 完成、回滚触发）必须即时广播。
- 统一模板：时间 + 阶段 + 结果 + 下一步 + 风险。

状态播报模板：

```text
[2026-05-01 21:15] Phase 1 完成
结果：后端 v0.1.0 部署成功，health=ok
指标：5xx=0.2%，P95=430ms
风险：无
下一步：21:30 开始 Phase 2 前端发布
```

### 3.4 上线前准备清单

| 分类 | 检查项 | 状态 |
|---|---|---|
| 环境 | 生产变量已下发且加密存储 | ☐ |
| 备份 | 数据与配置已完成快照 | ☐ |
| 安全 | 密钥轮换完成 | ☐ |
| 监控 | 告警渠道与值守人员已验证 | ☐ |
| 文档 | 上线与回滚手册可访问 | ☐ |

## 4. 灰度发布策略（可选）

### 4.1 金丝雀发布

流量建议：10% -> 50% -> 100%

| 批次 | 比例 | 观察时长 | 放量条件 |
|---|---|---|---|
| G1 | 10% | 30 分钟 | 无 P0/P1，关键指标达标 |
| G2 | 50% | 60 分钟 | G1 达标且用户反馈可控 |
| G3 | 100% | 120 分钟 | G2 达标且告警稳定 |

### 4.2 特性开关（Feature Flag）

- 对高风险新功能启用开关（例如新流程节点类型、实验性编辑器能力）。
- 开关状态纳入发布记录，发生问题可“关闭功能而非整体回滚”。

### 4.3 A/B 测试（若适用）

MVP 阶段可不强制；若启用应保证：

- 实验分组可追溯。
- 关键业务路径不受实验影响。
- 出现故障可快速全量回退到 A 组。

## 5. 上线步骤（分阶段）

### Phase 1：部署后端新版本

```bash
cd apps/api
npm install --omit=dev
npm run build
NODE_ENV=production npm run start:prod
```

若使用 PM2：

```bash
pm2 restart flowchart-api
pm2 logs flowchart-api --lines 100
```

健康检查：

```bash
curl -i http://127.0.0.1:3000/api/v1/health
```

关键接口验证：

```bash
curl -i http://127.0.0.1:3000/api-docs
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"release-checker"}'
```

### Phase 2：部署前端新版本

```bash
cd apps/web
npm install
npm run build
```

发布到 Nginx/CDN 后验证：

- 首页可加载（HTTP 200）。
- 刷新子路由不会 404（SPA fallback 正常）。
- /api 请求可正确代理到后端。

缓存策略建议：

- 静态资源 hash 文件长期缓存。
- index.html 短缓存或 no-cache，保证入口快速更新。

### Phase 3：数据迁移（若涉及）

当前 MVP 内存模式默认不执行迁移；若切换 PostgreSQL，执行标准流程：

1. 迁移脚本 dry-run。
2. 迁移窗口内只读（可选）。
3. 完成后抽样校验（项目、流程、执行状态、审计日志）。
4. 放开写入并持续观测。

### Phase 4：用户通知与功能验收

- 发布公告（版本号、变更点、已知限制）。
- 业务方验收关键路径并签字确认。
- 记录“上线完成时间”和“稳定运行开始时间”。

## 6. 风险控制

### 6.1 已知风险清单（导入 context）

| 风险 | 来源 | 影响 | 当前状态 |
|---|---|---|---|
| QA 运行时联调证据缺失 | context 阻塞项 | 发布门禁阻塞 | 未解除 |
| 内存存储重启丢失 | context 架构约束 | 数据可追溯性风险 | 未解除 |
| submit 非 DB 事务/outbox | context 风险记录 | 一致性风险（扩展阶段） | 未解除 |
| 节点初始 READY 简化语义 | context 风险记录 | 流程语义与真实生产有差异 | 未解除 |

来源文档：[docs/context/flowchart-collaboration-context.md](../context/flowchart-collaboration-context.md)

### 6.2 阻塞条件

- 发现 P0 缺陷：立即停止发布。
- 核心指标连续超阈值：暂停放量并进入应急评审。
- 安全高危告警新增：默认触发回滚评估。

### 6.3 应急响应

| 事件级别 | 响应时限 | 动作 |
|---|---|---|
| P0 | 5 分钟内 | 停止发布、建立 War Room、评估回滚 |
| P1 | 15 分钟内 | 降级或热修复，必要时部分回滚 |
| P2 | 60 分钟内 | 记录缺陷，安排修复窗口 |

### 6.4 告警阈值建议

- 错误率：5xx > 2%（5 分钟）
- 延迟：P95 > 1200ms（10 分钟）
- 认证异常：401/403 占比异常升高且无法解释
- 资源：内存 > 85%，CPU > 90%（10 分钟）

## 7. 监控与告警

### 7.1 上线后 24 小时重点指标

| 类别 | 指标 | 观察窗口 |
|---|---|---|
| 可用性 | health 可达率、5xx 比例 | 实时 + 24h |
| 性能 | P95/P99 延迟、吞吐 | 实时 + 24h |
| 业务 | 创建项目成功率、提交成功率、门禁通过率 | 每小时 |
| 安全 | 鉴权失败趋势、异常来源 IP | 实时 |

### 7.2 自动告警规则

```yaml
alerts:
  - name: api_5xx_high
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.02
    for: 5m
  - name: api_p95_latency_high
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1.2
    for: 10m
  - name: health_probe_failed
    expr: up{job="flowchart-api"} == 0
    for: 1m
```

说明：以上为规则示例，需按实际指标命名调整。

### 7.3 日志收集与分析

- Node 应用日志：PM2 / journald。
- Nginx access/error 日志：定位 4xx/5xx 与代理问题。
- 统一检索维度：requestId、path、status、durationMs。

### 7.4 用户反馈收集渠道

- 发布群反馈线程（即时）。
- 工单系统（可追踪）。
- 关键用户回访（上线后 24-72 小时）。

## 8. 事后回顾（Postmortem）

### 8.1 发布总结模板

```markdown
# 发布总结 - vX.Y.Z

## 基本信息
- 发布时间：
- 发布负责人：
- 参与角色：

## 结果
- 是否按计划完成：
- 实际影响范围：
- 核心指标对比：

## 问题与处理
- 发现问题：
- 处置动作：
- 回滚/降级：

## 经验与改进
- 做得好的点：
- 需要改进：
- 下一步行动项：
```

### 8.2 问题复盘

复盘建议采用 5W1H：

- What：发生了什么。
- Why：根因是什么。
- Where：在哪个阶段暴露。
- Who：谁来跟进闭环。
- When：何时完成整改。
- How：如何避免再次发生。

### 8.3 迭代改进建议

1. 将运行时联调证据纳入发布硬门槛并自动化采集。
2. 尽快完成 PostgreSQL 持久化迁移，降低重启丢数风险。
3. 建立统一 CHANGELOG 与版本矩阵，提升追溯效率。
4. 将 go-live 检查清单集成到 CI/CD gate，减少人为遗漏。

## 9. 发布执行总表（一页版）

| 阶段 | 核心动作 | 验证方式 | 结论 |
|---|---|---|---|
| Pre-check | QA/安全/性能/文档核对 | 清单 + 评审会议 | ☐ |
| Phase 1 | 后端发布 | health + token + 关键接口 | ☐ |
| Phase 2 | 前端发布 | 页面可访问 + API 代理 | ☐ |
| Phase 3 | 数据迁移（可选） | 抽样数据校验 | ☐ |
| Phase 4 | 用户通知与验收 | 通知回执 + 验收记录 | ☐ |
| Post 24h | 指标与反馈复核 | 看板 + 工单 + 复盘会 | ☐ |
