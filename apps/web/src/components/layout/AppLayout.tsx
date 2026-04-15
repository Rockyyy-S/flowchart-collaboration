import { Outlet, Link, useLocation } from 'react-router-dom';
import { Layout, Typography } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;

/**
 * 全局应用布局
 * - 顶部固定导航栏
 * - 主内容区域（响应式内边距）
 */
export default function AppLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <Layout className="min-h-screen" style={{ background: '#f5f6fa' }}>
      {/* 顶部导航 */}
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ApartmentOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Typography.Text strong style={{ fontSize: 17, color: '#222' }}>
            Flowkit
          </Typography.Text>
        </Link>
        {!isHome && (
          <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
            / 项目详情
          </Typography.Text>
        )}
      </Header>

      {/* 主内容区 */}
      <Content
        style={{
          padding: '24px 16px',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Outlet />
      </Content>
    </Layout>
  );
}
