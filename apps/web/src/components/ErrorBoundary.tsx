import React from 'react';

/**
 * 错误边界组件 —— 捕获子组件渲染错误，防止全页白屏。
 *
 * 使用方式：
 *   <ErrorBoundary resetKey={someKey}>
 *     <ChildComponent />
 *   </ErrorBoundary>
 *
 * 当 resetKey 变化时自动重置错误状态。
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** 当此值变化时，自动清除错误状态并重试渲染 */
  resetKey?: string | number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    /* 将错误信息输出到控制台，便于开发调试 */
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    /* resetKey 变化时自动重置错误状态 */
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  /* 手动重置：刷新页面 */
  handleReload = () => {
    window.location.reload();
  };

  /* 手动重置：仅清除错误状态 */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: 32,
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h3 style={{ color: '#1e293b', marginBottom: 8 }}>渲染出现异常</h3>
          <p style={{ maxWidth: 420, marginBottom: 20, lineHeight: 1.6 }}>
            画布组件遇到了意外错误，当前视图无法正常显示。
            您可以尝试重试或刷新页面。
          </p>
          {this.state.error && (
            <pre
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 12,
                maxWidth: 500,
                overflow: 'auto',
                marginBottom: 20,
                textAlign: 'left',
                color: '#ef4444',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              重试
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
