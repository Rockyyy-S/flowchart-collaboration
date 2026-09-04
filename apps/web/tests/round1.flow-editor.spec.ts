import { expect, test } from '@playwright/test';
import {
  addStartNodeByDoubleClick,
  addTaskNodeByToolbar,
  attachDiagnostics,
  createProjectViaUi,
  createTeamViaUi,
  issueToken,
  loginByStorage,
  wireDiagnostics,
} from './helpers/e2e-helpers';

/**
 * Round 1：基础 happy path 回归。
 */
test('Round1 - 流程图编辑器基础路径覆盖', async ({ page, request }, testInfo) => {
  const diag = wireDiagnostics(page);
  const stamp = Date.now();
  const teamName = `QA团队-R1-${stamp}`;
  const projectName = `QA项目-R1-${stamp}`;
  const flowchartName = `主流程图-R1-${stamp}`;
  const startNodeName = `启动节点-${stamp}`;
  const taskNodeName = `开发任务-${stamp}`;

  try {
    const token = await issueToken(request, 'user-001');
    await loginByStorage(page, token, 'user-001');

    // 覆盖：团队创建（名称+描述）
    await createTeamViaUi(page, teamName, 'Round1 自动化测试团队');

    // 覆盖：项目创建表单必填验证
    await page.getByRole('button', { name: '项目' }).click();
    await page.getByRole('button', { name: '新建项目' }).first().click();
    const createModal = page.locator('.ant-modal').filter({ hasText: '新建项目' }).last();
    await expect(createModal).toBeVisible();
    await createModal.getByRole('button', { name: '创建' }).click();
    await expect.soft(page.getByText('请输入项目名称')).toBeVisible();
    await expect.soft(page.getByText('请选择绑定的团队')).toBeVisible();
    await createModal.getByRole('button', { name: '取消' }).click();

    // 覆盖：新建项目 + 同时创建流程图
    await createProjectViaUi(page, projectName, 'Round1 基础路径项目', flowchartName);
    await expect.soft(page.locator('.workspace-tab-label__primary', { hasText: flowchartName })).toBeVisible({ timeout: 15_000 });

    // 覆盖：编辑模式切换 + 双击新增节点 + 快捷新增节点
    const editSwitch = page.locator('.flow-canvas-toolbar-mode .ant-switch');
    await editSwitch.click();
    await addStartNodeByDoubleClick(page, startNodeName);
    await addTaskNodeByToolbar(page, taskNodeName);

    // 覆盖：节点 ID 格式验证（node_ 前缀）
    const taskNode = page.locator('.real-flow-node', { hasText: taskNodeName }).first();
    await taskNode.click();
    const nodeIdText = page.locator('.real-flow-node', { hasText: taskNodeName }).locator('text=/node_[a-z0-9_]+/').first();
    await expect.soft(nodeIdText).toBeVisible();

    // 覆盖：拖拽节点
    const boxBefore = await taskNode.boundingBox();
    if (boxBefore) {
      await page.mouse.move(boxBefore.x + boxBefore.width / 2, boxBefore.y + boxBefore.height / 2);
      await page.mouse.down();
      await page.mouse.move(boxBefore.x + boxBefore.width / 2 + 120, boxBefore.y + boxBefore.height / 2 + 40);
      await page.mouse.up();
    }

    // 覆盖：连线创建
    await taskNode.click();
    await page.getByRole('button', { name: '连线' }).click();
    const startNode = page.locator('.real-flow-node', { hasText: startNodeName }).first();
    await startNode.click();

    // 覆盖：缩放（按钮 + 滚轮）
    const zoomLabel = page.locator('.flow-canvas-zoom-label');
    const zoomBefore = await zoomLabel.textContent();
    await page.locator('.flow-canvas-zoom-floating button[title*="放大"]').click();
    await page.mouse.wheel(0, -600);
    const zoomAfter = await zoomLabel.textContent();
    await expect.soft(zoomAfter).not.toEqual(zoomBefore);

    // 覆盖：平移画布
    const canvas = page.locator('.flow-canvas-container');
    const canvasBox = await canvas.boundingBox();
    const transformLayer = page.locator('.flow-canvas-transform');
    const transformBefore = await transformLayer.getAttribute('style');
    if (canvasBox) {
      await page.mouse.move(canvasBox.x + 60, canvasBox.y + 60);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 220, canvasBox.y + 160);
      await page.mouse.up();
    }
    const transformAfter = await transformLayer.getAttribute('style');
    await expect.soft(transformAfter).not.toEqual(transformBefore);

    // 覆盖：保存草稿 + 刷新持久化
    await page.getByRole('button', { name: '保存草稿' }).click();
    await expect.soft(page.getByText('流程草稿已保存')).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect.soft(page.locator('.real-flow-node')).toHaveCount(3, { timeout: 15_000 });

    // 覆盖：节点详情面板打开/关闭 + 面板边界
    await page.locator('.flow-canvas-toolbar-mode .ant-switch').click();
    await page.locator('.real-flow-node').first().click();
    const panel = page.locator('.node-detail-panel');
    await expect.soft(panel).toBeVisible();
    await expect.soft(page.getByText('节点信息')).toBeVisible();
    const panelBox = await panel.boundingBox();
    const viewport = page.viewportSize();
    if (panelBox && viewport) {
      expect.soft(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width + 2);
    }
    await panel.locator('button').first().click();
  } finally {
    await attachDiagnostics(testInfo, diag);
  }
});
