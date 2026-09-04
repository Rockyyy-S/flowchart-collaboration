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
 * Round 2：边界、异常、组合场景回归。
 */
test('Round2 - 流程图编辑器边界与异常场景', async ({ page, request }, testInfo) => {
  const diag = wireDiagnostics(page);
  const stamp = Date.now();
  const teamName = `QA团队-R2-${stamp}`;
  const projectName = `QA项目-R2-${stamp}`;
  const flowchartName = `边界流程图-R2-${stamp}`;
  const longNodeName = `超长节点名称_这是一个用于验证UI截断行为的测试节点_${stamp}_ABCDEFGHIJKLMNOPQRSTUVWXYZ`;
  const specialNodeName = `节点@#￥%_中文_符号_${stamp}`;

  try {
    const token = await issueToken(request, 'user-001');
    await loginByStorage(page, token, 'user-001');

    await createTeamViaUi(page, teamName, 'Round2 边界测试团队');
    await createProjectViaUi(page, projectName, 'Round2 边界项目', flowchartName);

    // 切到编辑模式
    await page.locator('.flow-canvas-toolbar-mode .ant-switch').click();

    // 覆盖：空流程图双击创建起始节点
    await addStartNodeByDoubleClick(page, '起始节点-R2');

    // 覆盖：特殊字符节点名称
    await addTaskNodeByToolbar(page, specialNodeName);
    const specialNode = page.locator('.real-flow-node', { hasText: '节点@#￥%' }).first();
    await expect.soft(specialNode).toBeVisible();

    // 覆盖：长名称截断（通过 scrollWidth > clientWidth 判断）
    await addTaskNodeByToolbar(page, longNodeName);
    const longNameText = page
      .locator('.real-flow-node', { hasText: '超长节点名称_这是一个用于验证UI截断行为的测试节点' })
      .locator('.ant-typography')
      .first();
    await expect.soft(longNameText).toBeVisible();
    const isTruncated = await longNameText.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect.soft(isTruncated).toBeTruthy();

    // 覆盖：工具栏单行不换行
    const toolbar = page.locator('.flow-canvas-toolbar').first();
    const toolbarWrap = await toolbar.evaluate((el) => getComputedStyle(el).flexWrap);
    expect.soft(toolbarWrap).toBe('nowrap');

    // 覆盖：500px 高度窗口布局
    await page.setViewportSize({ width: 1365, height: 500 });
    await page.waitForTimeout(500);
    await expect.soft(page.locator('.flow-canvas-toolbar')).toBeVisible();
    await expect.soft(page.locator('.flow-canvas-zoom-floating')).toBeVisible();

    // 覆盖：缩放上下限（按钮多次点击后不应超界）
    for (let i = 0; i < 20; i += 1) {
      await page.locator('.flow-canvas-zoom-floating button[title*="放大"]').click();
    }
    const zoomMaxText = await page.locator('.flow-canvas-zoom-label').textContent();
    const zoomMax = Number((zoomMaxText ?? '0').replace('%', ''));
    expect.soft(zoomMax).toBeLessThanOrEqual(300);

    for (let i = 0; i < 30; i += 1) {
      await page.locator('.flow-canvas-zoom-floating button[title*="缩小"]').click();
    }
    const zoomMinText = await page.locator('.flow-canvas-zoom-label').textContent();
    const zoomMin = Number((zoomMinText ?? '0').replace('%', ''));
    expect.soft(zoomMin).toBeGreaterThanOrEqual(10);

    // 覆盖：保存并验证 DRAFT 相关成功提示
    await page.getByRole('button', { name: '保存草稿' }).click();
    await expect.soft(page.getByText('流程草稿已保存')).toBeVisible({ timeout: 15_000 });

    // 覆盖：只读提示（当前用户非节点参与者时）
    await page.locator('.flow-canvas-toolbar-mode .ant-switch').click();
    await page.locator('.real-flow-node').first().click();
    await expect.soft(page.getByText('当前为只读查看模式')).toBeVisible({ timeout: 15_000 });

    // 覆盖：面板不超出边界
    const panel = page.locator('.node-detail-panel');
    const panelBox = await panel.boundingBox();
    const viewport = page.viewportSize();
    if (panelBox && viewport) {
      expect.soft(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewport.height + 2);
    }
  } finally {
    await attachDiagnostics(testInfo, diag);
  }
});
