# 前端回归测试报告（Round1/Round2）
> 版本：v1 | 日期：2026-05-01 | 负责角色：QA专家 | 状态：受限执行（当前会话无法发起终端命令），已完成静态替代验证与最小修复

## 测试范围

- 目标：验证“上轮前端改动是否生效”，覆盖以下 6 个功能点：
  - 用户/团队选择下拉框
  - 项目创建后自动创建流程图
  - 工具栏单行布局
  - 缩放控件右上角悬浮
  - 节点详情面板不超出画布
  - 节点 ID 前缀_唯一id 规则
- 计划命令（应在 apps/web 执行）：
  - npm run test:e2e:round1
  - npm run test:e2e:round2
- 执行限制：本次会话工具不具备终端命令执行能力，仅可读文件与代码编辑；因此无法在本会话内产出新的 Playwright 运行工件。

## 结果与缺陷

### 1) 测试执行结果汇总（round1/round2）

- round1：未执行（受限）
- round2：未执行（受限）
- 通过率：N/A（本次未生成运行结果）

### 2) 失败功能清单（按严重度）

- P1（高）：工具栏“单行”在窄宽度下会出现换行/分层显示，与需求不一致。
- P1（高）：用户/团队下拉联动不充分，成员下拉未严格跟随所选团队，存在“可选但不应可选”的误选风险。
- P2（中）：节点 ID 唯一性策略不够强，历史实现存在同名节点首个 ID 无唯一后缀的情况，不完全满足“前缀_唯一id”的严格口径。

### 3) 每个失败功能的复现步骤 + 根因推测 + 对应文件路径

#### 缺陷 A：工具栏非严格单行（P1）

- 复现步骤：
  1. 打开流程图画布。
  2. 缩小窗口到较窄宽度（如 1200px 左右或更小）。
  3. 观察工具栏左侧按钮组与状态信息，出现换行/纵向堆叠。
- 根因推测：
  - 左侧工具组允许换行，且窄屏媒体查询将布局改为起始对齐，破坏单行约束。
- 关联文件：
  - [apps/web/src/index.css](apps/web/src/index.css)

#### 缺陷 B：用户/团队下拉联动不严格（P1）

- 复现步骤：
  1. 打开“新建项目”弹窗。
  2. 未选团队前尝试选择“初始成员”。
  3. 或切换团队后观察成员列表是否仍保留旧团队成员。
- 根因推测：
  - 成员列表来源未绑定到当前 teamId，跨团队成员可能混入。
- 关联文件：
  - [apps/web/src/components/ProjectListPanel/index.tsx](apps/web/src/components/ProjectListPanel/index.tsx)

#### 缺陷 C：节点 ID 唯一后缀策略偏弱（P2）

- 复现步骤：
  1. 在同一流程中多次创建同名节点。
  2. 观察首个节点 ID 及后续同名节点 ID 规则。
- 根因推测：
  - 旧实现首个同名节点可能仅为语义化 slug，未始终带唯一后缀。
- 关联文件：
  - [apps/web/src/utils/naming.ts](apps/web/src/utils/naming.ts)

## 已完成的修复

### 4) 已完成的修复及改动文件

- 修复 1：团队/成员下拉联动
  - 变更点：成员选项改为严格按所选团队过滤；未选团队时禁用成员下拉；切换团队自动清空已选成员。
  - 文件：
    - [apps/web/src/components/ProjectListPanel/index.tsx](apps/web/src/components/ProjectListPanel/index.tsx)
- 修复 2：工具栏强制单行
  - 变更点：工具栏主容器、左侧组、统计组全部设为 nowrap；空间不足时左侧横向滚动；移除窄屏下导致多行的对齐策略。
  - 文件：
    - [apps/web/src/index.css](apps/web/src/index.css)
- 修复 3：节点 ID 改为始终带唯一后缀
  - 变更点：生成规则统一为 node_slug_uniqueSuffix，使用时间戳+随机串并带冲突重试。
  - 文件：
    - [apps/web/src/utils/naming.ts](apps/web/src/utils/naming.ts)

## 放行建议

- 当前建议：❌暂不放行
- 原因：本会话无法真实执行 Playwright，缺少 round1/round2 的运行证据、失败日志、截图/视频/trace 工件。
- 放行前必须补齐：
  - [apps/web/test-results/results.json](apps/web/test-results/results.json)
  - [apps/web/playwright-report](apps/web/playwright-report)
  - 失败用例截图/视频/trace 路径（由 Playwright 执行后自动生成）

## 回归计划

- 在具备终端执行能力的环境中，于 apps/web 目录执行：
  - npm install
  - npm run test:e2e:round1
  - npm run test:e2e:round2
- 回归重点断言：
  - 团队选择后成员下拉是否只展示该团队成员
  - 工具栏是否始终单行（不同分辨率）
  - 节点 ID 是否始终为 node_前缀且带唯一后缀
  - 缩放控件是否固定在画布右上角
  - 节点详情面板边界是否在画布可视区内
- 若仍有失败：将失败用例对应的 screenshot/video/trace 路径补录到本报告。
