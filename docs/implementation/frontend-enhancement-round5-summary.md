# 前端增强 第五轮 —— 工具栏美化、用户选择、API集成

**执行时间**：2026-04-30  
**执行人角色**：前端专家  
**状态**：✅ 完成

---

## 改动文件清单

### 1. ProjectListPanel（用户选择 + 流程图API集成）
- **文件**：`apps/web/src/components/ProjectListPanel/index.tsx`
- **改动**：
  - 从 `getMyTeams()` 提取所有 memberIds，构建可选团队成员列表
  - memberIds 从 `mode="tags"` 改为 `mode="multiple"` 下拉选择
  - handleCreateProject 中处理 memberIds 为数组格式（不再需要 trim/filter）
  - 流程图创建API集成已在现有代码中实现：`if (values.createFlowchart && values.flowchartName?.trim())` 自动调用 `createFlowchart()`，失败时不阻断项目创建（toast 降级提示）

### 2. FlowCanvas（assignees 下拉 + 工具栏单行 + 缩放浮窗）
- **文件**：`apps/web/src/components/FlowCanvas/index.tsx`
- **改动**：
  - 新增 `availableAssignees` memo：从 nodeConfig 中提取所有 assignees ID，用作下拉选项
  - 新增节点表单：assignees 从 `mode="tags"` 改为 `mode="multiple"` 下拉选择
  - 工具栏改为单行 flex 布局：
    - 左侧：Mode + Refresh + Add/Delete/Connect/Save 按钮（flex row, gap:8px）
    - 中间：spacer (flex: 1)
    - 右侧：统计信息 + 提示文本
    - 所有按钮统一 height:32px
  - 缩放控件从工具栏-right 移出，创建新的 `.flow-canvas-zoom-floating` 浮窗：
    - position:absolute, top:12px, right:12px, z-index:5
    - 垂直排列三个按钮：Zoom+ / 百分比显示 / Zoom-
    - 半透明背景 rgba(255,255,255,0.96) + border + box-shadow

### 3. NodeDetailPanel（面板约束）
- **文件**：`apps/web/src/components/NodeDetailPanel/index.tsx`
- **改动**：
  - 根容器添加 inline style：`overflowY: 'auto', maxHeight: 'calc(100vh - 80px)'`
  - 确保面板内容可滚动，高度不超出视口

### 4. TeamManagement（成员选择下拉）
- **文件**：`apps/web/src/components/TeamManagement/index.tsx`
- **改动**：
  - 新增 `availableMemberIds` memo：从所有 teams 中提取 memberIds 并去重排序
  - 创建团队表单：memberIds 从 `mode="tags"` 改为 `mode="multiple"` 下拉选择
  - 添加成员弹窗：memberId 从 Input 改为 Select 下拉（单选）

### 5. CSS 样式
- **文件**：`apps/web/src/index.css`
- **改动**：
  - `.flow-canvas-toolbar`：单行 flex 布局，height:60px, gap:12px, justify-content:space-between
  - `.flow-canvas-toolbar-left`：flex row, gap:8px, flex-wrap
  - `.flow-canvas-zoom-floating`：新增右上角浮窗样式（见上文详细样式）
  - `.flow-canvas-toolbar-mode`：模式开关容器样式（border, padding, border-radius）
  - `.flow-canvas-stat-pill`：统计药丸样式

---

## API 集成验证

### 流程图创建链路
```typescript
// ProjectListPanel.handleCreateProject() 流程
1. form.validateFields() 获取表单值
2. createProject(name, teamId, description, memberIds)  ← 创建项目
3. updateFlowDraft(projectId, demoFlow)  ← 初始化流程定义
4. if (values.createFlowchart && values.flowchartName?.trim())  ← 条件检查
5.   createFlowchart(projectId, { name: flowchartName })  ← 创建流程图
6.   onSuccess: toast + 打开流程图标签（传递 flowchartId）
7.   onError: toast warning（继续打开项目面板，流程图创建失败不阻断）
```

### 网络请求签名
```
POST /api/v1/projects
  body: { name, teamId, description, members: [{userId, role}] }
  response: { projectId, ... }

POST /api/v1/projects/{projectId}/flowcharts
  body: { name, description? }
  response: { id, name, projectId, ... }
```

### 错误处理
- 流程图创建失败：catch 并调用 `message.warning()` 降级处理，不阻断项目打开流程
- 用户选择数据源失败：从 getMyTeams() catch 后使用空数组降级

---

## UI 布局变化描述

### 工具栏 —— 从三分区到单行
**之前（三分区）**：
```
┌─────────────────────────────────────────────────────┐
│ [Left: Mode/Refresh/Add/Delete/Connect/Save] [spacer] [Right: Stats/Zoom/Hint] │
└─────────────────────────────────────────────────────┘
(垂直排列，Right 下方还有 zoom 控制器)
```

**之后（单行）**：
```
┌──────────────────────────────────────────────────────────┐
│ [Mode] [Refresh] [Add▼] [Delete] [Connect] [Save] [spacer] [Stats] [Hint] │
└──────────────────────────────────────────────────────────┘
(单行，紧密排列，gap:8px，按钮统一 32px 高度)
```

### 缩放浮窗 —— 右上角悬浮
**位置**：画布容器右上角（position:absolute, top:12px, right:12px）  
**布局**：垂直排列三个按钮
```
┌────┐
│ +  │  Zoom In
├────┤
│150%│  百分比（可点击重置）
├────┤
│ -  │  Zoom Out
└────┘
```

**样式特性**：
- 半透明背景 (rgba(255,255,255,0.96))
- 圆角 12px，border 1px，box-shadow 中等
- backdrop-filter 模糊效果
- hover 时阴影增强

### 节点面板 —— 高度约束
**之前**：overflow:hidden，内容超界时截断  
**之后**：
```css
.node-detail-panel {
  overflowY: 'auto';
  maxHeight: 'calc(100vh - 80px)';
}
```
内容可滚动，最大高度限制在视口以内

---

## 关键实现摘要

### 1. 用户选择器（三处统一升级）

**ProjectListPanel - memberIds**
```typescript
// 数据源构建
const availableMemberIds = useMemo(() => {
  const memberSet = new Set<string>();
  myTeams.forEach((team) => {
    team.memberIds.forEach((id) => memberSet.add(id));
  });
  return Array.from(memberSet).sort();
}, [myTeams]);

// 表单配置
<Select
  mode="multiple"
  placeholder="请选择初始成员"
  options={availableMemberIds.map((id) => ({ value: id, label: id }))}
/>

// 处理方式变更
const memberIds = values.memberIds?.length ? values.memberIds : undefined;
// 不再需要 .map(trim).filter(Boolean) 转换
```

**FlowCanvas - assignees 类似模式**  
**TeamManagement - 成员选择同理**

### 2. 流程图创建 API 集成

**条件创建**：
```typescript
if (values.createFlowchart && values.flowchartName?.trim()) {
  try {
    flowchart = await createFlowchart(project.projectId, { 
      name: values.flowchartName.trim() 
    });
  } catch {
    message.warning('项目已创建，但流程图创建失败，可稍后手动创建');
    // 不 throw，继续业务流程
  }
}
```

**打开流程图**：
```typescript
if (flowchart) {
  onOpenFlowchart({
    projectId: project.projectId,
    projectName: project.name,
    projectRole: 'OWNER',
    flowchartId: flowchart.id,  // ← 传递流程图ID
    flowchartName: flowchart.name,
  });
} else {
  // 降级：打开项目面板，稍后手动创建流程图
  setExpandedProjectId(project.projectId);
}
```

### 3. 工具栏布局重构

**CSS 单行 flex**：
```css
.flow-canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 60px;
}

.flow-canvas-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;  /* 紧密排列 */
  flex-wrap: wrap;
}
```

**按钮统一高度**：
```tsx
<Button size="small" style={{ height: 32 }} />
```

### 4. 缩放浮窗实现

**JSX 结构**：
```tsx
<div className="flow-canvas-zoom-floating">
  <Button
    type="text"
    size="small"
    icon={<ZoomInOutlined />}
    onClick={() => { const newScale = Math.min(scaleRef.current * 1.25, 3); setScale(newScale); }}
  />
  <span
    className="flow-canvas-zoom-label"
    onClick={() => { setScale(1); }}
    title="点击重置为 100%"
  >
    {Math.round(scale * 100)}%
  </span>
  <Button
    type="text"
    size="small"
    icon={<ZoomOutOutlined />}
    onClick={() => { const newScale = Math.max(scaleRef.current * 0.8, 0.1); setScale(newScale); }}
  />
</div>
```

**CSS 定位**：
```css
.flow-canvas-zoom-floating {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
}
```

### 5. 面板高度约束

```typescript
return (
  <>
    <div 
      className="node-detail-panel" 
      style={{ 
        overflowY: 'auto', 
        maxHeight: 'calc(100vh - 80px)' 
      }}
    >
      {/* 内容可滚动 */}
    </div>
  </>
);
```

---

## TypeScript 验证结果

**编译结果**：✅ 零错误  
**检查范围**：
- ProjectListPanel/index.tsx
- FlowCanvas/index.tsx
- NodeDetailPanel/index.tsx
- TeamManagement/index.tsx

**使用工具**：`get_errors()` 针对上述四个文件

---

## 风险与兼容性说明

### 1. 响应式设计 —— <1024px 时表现
- **工具栏 <1024px**：
  - 按钮仍保持 32px 高度，flex-wrap 自动换行
  - 可选：CSS 媒体查询改为单行+隐藏文本（icon only）
  - **当前实现**：允许换行，不收敛文本（保持可读性）

- **缩放浮窗 <768px**：
  - 仍保持右上角位置，可能与其他浮窗重叠
  - **建议**：如需改为 modal 显示，可在 MainWorkspace 级别条件渲染

- **面板高度 <600px**：
  - NodeDetailPanel max-height 基于视口计算
  - 如画布高度极小（如 <400px），panel 内容可能极其拥挤
  - **降级方案**：未来可改为 modal 显示

### 2. 用户选择器数据源
- **现状**：从 getMyTeams() 或现有 nodeConfig 提取成员
- **局限**：无法显示系统内全部用户，仅显示当前团队成员
- **未来**：如需完整用户列表，需后端补齐 `GET /api/v1/users` API

### 3. 流程图创建降级
- **失败场景**：createFlowchart() 异常时
- **降级处理**：项目创建成功，流程图创建失败 → 项目展开面板 + toast 提示
- **用户体验**：用户可稍后手动创建流程图，不影响核心项目创建流程

### 4. 向后兼容性
- **现有流程**：无 breaking changes
  - 选择器从 tags → multiple 只是 UI 升级，数据格式（数组）保持一致
  - 工具栏布局改为 flex，不影响功能
  - 面板 overflow 改为 auto，默认不显示滚动条（内容足够时）

### 5. 浏览器兼容性
- **flex 布局**：IE 11+ 支持
- **CSS grid**（node-detail-overview）：IE 不支持，降级无网格布局但仍可用
- **backdrop-filter**（zoom浮窗模糊）：主流浏览器支持，IE/旧版本降级为无模糊效果

---

## 交接清单

- ✅ 前端实现完成，代码 TypeScript 通过
- ✅ 改动文件清单已列出
- ✅ API 集成验证逻辑已确认
- ✅ UI 布局图示已描述（文字形式）
- ✅ 关键实现代码片段已附录
- ✅ 风险评估与兼容性说明已完成

### 后续交接
- **to_qa**：回归测试工具栏单行显示、用户选择下拉、流程图自动创建、面板约束等
- **to_docs**：如用户流程变更（新建项目时自动创建流程图），补齐用户指南
- **to_project_coordinator**：如发现风险项需跨角色决策，上报协调

---

**完成时间**：2026-04-30  
**前端专家确认**：✅ 实现完毕，可进入 QA 阶段
