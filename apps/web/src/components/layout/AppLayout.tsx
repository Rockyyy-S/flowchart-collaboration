import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Button,
  Form,
  Input,
  Layout,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { ApartmentOutlined, LogoutOutlined, SafetyOutlined } from '@ant-design/icons';
import { issueDevToken } from '../../api/auth';
import {
  clearTokenSnapshot,
  getTokenSnapshot,
  setTokenSnapshot,
  subscribeTokenChange,
} from '../../auth/token';

const { Header, Content } = Layout;

/**
 * 全局应用布局
 * - 顶部固定导航栏
 * - 主内容区域（响应式内边距）
 */
export default function AppLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [tokenSnapshot, setSnapshot] = useState(getTokenSnapshot);
  const [loginOpen, setLoginOpen] = useState(false);
  const [issuingToken, setIssuingToken] = useState(false);
  const [form] = Form.useForm<{ userId: string }>();

  useEffect(() => {
    return subscribeTokenChange(() => {
      setSnapshot(getTokenSnapshot());
    });
  }, []);

  async function handleIssueToken() {
    try {
      const values = await form.validateFields();
      setIssuingToken(true);
      const tokenData = await issueDevToken(values.userId.trim());
      setTokenSnapshot(tokenData.accessToken, values.userId.trim());
      message.success('开发令牌已获取，可继续执行写操作');
      setLoginOpen(false);
      form.resetFields();
    } catch {
      // 请求失败由全局拦截器提示
    } finally {
      setIssuingToken(false);
    }
  }

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
        <div style={{ marginLeft: 'auto' }}>
          <Space>
            {tokenSnapshot ? (
              <>
                <Tag color="success" icon={<SafetyOutlined />}>
                  已登录 {tokenSnapshot.userId ? `(${tokenSnapshot.userId})` : ''}
                </Tag>
                <Button size="small" onClick={() => setLoginOpen(true)}>
                  更换令牌
                </Button>
                <Button
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={() => {
                    clearTokenSnapshot();
                    message.info('已清除本地令牌');
                  }}
                >
                  退出
                </Button>
              </>
            ) : (
              <Button size="small" type="primary" onClick={() => setLoginOpen(true)}>
                获取开发令牌
              </Button>
            )}
          </Space>
        </div>
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

      <Modal
        title="获取开发令牌"
        open={loginOpen}
        onCancel={() => {
          setLoginOpen(false);
          form.resetFields();
        }}
        onOk={handleIssueToken}
        okText="获取并登录"
        cancelText="取消"
        confirmLoading={issuingToken}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          该流程用于开发联调，调用公开接口签发 JWT，替代旧版 x-user-id 头。
        </Typography.Paragraph>
        <Form form={form} layout="vertical" initialValues={{ userId: 'user-001' }}>
          <Form.Item
            label="用户 ID"
            name="userId"
            rules={[
              { required: true, message: '请输入用户 ID' },
              { min: 3, message: '用户 ID 至少 3 个字符' },
              { max: 64, message: '用户 ID 不超过 64 个字符' },
            ]}
          >
            <Input placeholder="例如：user-001" autoFocus maxLength={64} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
