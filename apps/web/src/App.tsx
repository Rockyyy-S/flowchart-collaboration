import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/layout/AppLayout';
import WorkbenchPage from './pages/WorkbenchPage';
import ProjectPage from './pages/ProjectPage';

/**
 * 根组件：路由配置 + Ant Design 全局配置（中文语言包）
 */
export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<WorkbenchPage />} />
              <Route path="/projects/:projectId" element={<ProjectPage />} />
            </Route>
            {/* 兜底：未命中路由跳回首页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
