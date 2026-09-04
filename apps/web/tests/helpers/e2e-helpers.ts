import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api/v1';

/**
 * 诊断日志结构：用于失败时附加网络和控制台信息。
 */
interface DiagnosticsBuffer {
  requestFailures: string[];
  httpErrors: string[];
  consoleErrors: string[];
}

/**
 * 绑定页面诊断监听器，失败用例可将日志附加到报告中。
 */
export function wireDiagnostics(page: Page): DiagnosticsBuffer {
  const buffer: DiagnosticsBuffer = {
    requestFailures: [],
    httpErrors: [],
    consoleErrors: [],
  };

  page.on('requestfailed', (request) => {
    buffer.requestFailures.push(
      `[requestfailed] ${request.method()} ${request.url()} -> ${request.failure()?.errorText ?? 'unknown'}`,
    );
  });

  page.on('response', async (response) => {
    if (response.status() < 400) return;
    const req = response.request();
    let bodyPreview = '';
    try {
      const text = await response.text();
      bodyPreview = text.slice(0, 300);
    } catch {
      bodyPreview = '<body-unavailable>';
    }
    buffer.httpErrors.push(
      `[http ${response.status()}] ${req.method()} ${response.url()} :: ${bodyPreview}`,
    );
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    buffer.consoleErrors.push(`[console.error] ${msg.text()}`);
  });

  return buffer;
}

/**
 * 测试结束时将诊断日志附加到报告。
 */
export async function attachDiagnostics(testInfo: TestInfo, buffer: DiagnosticsBuffer): Promise<void> {
  const payload = {
    requestFailures: buffer.requestFailures,
    httpErrors: buffer.httpErrors,
    consoleErrors: buffer.consoleErrors,
  };

  await testInfo.attach('diagnostics', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(payload, null, 2), 'utf-8'),
  });
}

/**
 * 调用后端开发令牌接口，返回 JWT。
 */
export async function issueToken(request: APIRequestContext, userId: string): Promise<string> {
  const resp = await request.post(`${API_BASE}/auth/token`, {
    data: { userId },
  });
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  return json?.data?.accessToken as string;
}

/**
 * 将 token 注入 sessionStorage，模拟前端登录态。
 */
export async function loginByStorage(page: Page, token: string, userId: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ t, u }) => {
      sessionStorage.setItem('flowkit_access_token', t);
      sessionStorage.setItem('flowkit_token_user_id', u);
      window.dispatchEvent(new Event('flowkit-token-changed'));
    },
    { t: token, u: userId },
  );
  await page.reload();
}

/**
 * 通过活动栏切换到“团队”面板。
 */
export async function openTeamsPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: '团队' }).click();
}

/**
 * 通过活动栏切换到“项目”面板。
 */
export async function openProjectsPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: '项目' }).click();
}

/**
 * 在团队面板创建团队。
 */
export async function createTeamViaUi(page: Page, name: string, description: string): Promise<void> {
  await openTeamsPanel(page);
  await page.getByRole('button', { name: '新建团队' }).first().click();
  const modal = page.locator('.ant-modal').filter({ hasText: '新建团队' }).last();
  await expect(modal).toBeVisible();
  await modal.getByLabel('团队名称').fill(name);
  await modal.getByLabel('团队描述').fill(description);
  await modal.getByRole('button', { name: '创建' }).click();
  await expect(page.getByText('团队已创建')).toBeVisible({ timeout: 10_000 });
}

/**
 * 在项目面板新建项目并自动创建流程图。
 */
export async function createProjectViaUi(
  page: Page,
  projectName: string,
  description: string,
  flowchartName: string,
): Promise<void> {
  await openProjectsPanel(page);
  await page.getByRole('button', { name: '新建项目' }).first().click();
  const modal = page.locator('.ant-modal').filter({ hasText: '新建项目' }).last();
  await expect(modal).toBeVisible();

  await modal.getByLabel('项目名称').fill(projectName);
  await modal.getByLabel('项目描述').fill(description);

  // 绑定团队（必填）
  const teamSelect = modal.locator('.ant-select').filter({ hasText: '请选择团队' }).first();
  await teamSelect.click();
  const option = page.locator('.ant-select-dropdown .ant-select-item-option-content').first();
  await expect(option).toBeVisible();
  await option.click();

  await modal.getByLabel('流程图名称').fill(flowchartName);
  await modal.getByRole('button', { name: '创建' }).click();

  // 成功提示可能是“项目已创建”或“项目已创建，但流程图创建失败”
  await expect(
    page.getByText(/项目已创建|流程图创建失败/),
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * 双击画布空白区域，创建起始节点。
 */
export async function addStartNodeByDoubleClick(page: Page, nodeName: string): Promise<void> {
  const canvas = page.locator('.flow-canvas-container');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('画布区域不可见，无法双击新增节点');
  await page.mouse.dblclick(box.x + box.width * 0.55, box.y + box.height * 0.55);

  const modal = page.locator('.ant-modal').filter({ hasText: '创建起始节点' }).last();
  await expect(modal).toBeVisible();
  await modal.getByLabel('节点名称').fill(nodeName);
  await modal.getByRole('button', { name: '创建起始节点' }).click();
}

/**
 * 通过工具栏“节点”按钮新增普通节点。
 */
export async function addTaskNodeByToolbar(page: Page, nodeName: string): Promise<void> {
  await page.getByRole('button', { name: '节点' }).click();
  await page.getByRole('menuitem', { name: '无分支任务节点' }).click();
  const modal = page.locator('.ant-modal').filter({ hasText: '新增流程节点' }).last();
  await expect(modal).toBeVisible();
  await modal.getByLabel('节点名称').fill(nodeName);
  await modal.getByRole('button', { name: '创建节点' }).click();
}
