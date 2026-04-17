import '@testing-library/jest-dom/vitest';

// 为 Ant Design 和组件逻辑补齐 jsdom 中缺失的浏览器能力。
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// FlowCanvas 与部分 UI 组件会读取 ResizeObserver，测试环境中提供最小 mock。
class ResizeObserverMock {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

(globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;
