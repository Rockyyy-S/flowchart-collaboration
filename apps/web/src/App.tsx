import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/layout/AppLayout';
import MainWorkspace from './pages/MainWorkspace';

/**
 * 根组件：路由配置 + Ant Design 全局配置（中文语言包）
 * 主页面采用三栏布局，项目切换通过左侧面板完成，无需页面跳转。
 */
export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{
      token: {
        colorPrimary: '#2563eb',
        borderRadius: 10,
        colorSuccess: '#059669',
        colorWarning: '#d97706',
        colorError: '#dc2626',
        colorInfo: '#2563eb',
        colorBgLayout: '#f8fafc',
        colorBgContainer: '#ffffff',
        colorTextBase: '#0f172a',
        colorBorder: '#dbe4f0',
        fontFamily: '"Lexend", "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      },
    }}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<MainWorkspace />} />
            </Route>
            {/* 兜底：未命中路由跳回首页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
