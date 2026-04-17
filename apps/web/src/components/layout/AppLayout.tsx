import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import {
  Button,
  Dropdown,
  Form,
  Input,
  Layout,
  Modal,
  Space,
  Typography,
  message,
} from 'antd';
import { ApartmentOutlined, LogoutOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
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
 * - 顶部毛玻璃导航栏（品牌渐变条 + 用户头像入口）
 * - 主内容区域铺满 Header 以下
 */
export default function AppLayout() {
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

  /* 用户头像首字母 */
  const avatarChar = tokenSnapshot?.userId ? tokenSnapshot.userId.charAt(0).toUpperCase() : '?';

  return (
    <Layout style={{ background: 'var(--color-bg-base)', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶部导航 —— 毛玻璃效果 */}
      <Header
        className="app-header"
        style={{
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          height: 56,
          lineHeight: '56px',
        }}
      >
        {/* 品牌入口 */}
        <Link to="/" className="app-brand">
          <ApartmentOutlined className="app-brand__icon" />
          <span className="app-brand__text">Flowkit</span>
        </Link>

        {/* 右侧用户区域 */}
        <div style={{ marginLeft: 'auto' }}>
          {tokenSnapshot ? (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'user',
                    label: (
                      <Space>
                        <SafetyOutlined style={{ color: 'var(--color-success)' }} />
                        <span>已登录: {tokenSnapshot.userId}</span>
                      </Space>
                    ),
                    disabled: true,
                  },
                  { type: 'divider' },
                  {
                    key: 'switch',
                    label: '更换令牌',
                    onClick: () => setLoginOpen(true),
                  },
                  {
                    key: 'logout',
                    label: '退出登录',
                    icon: <LogoutOutlined />,
                    danger: true,
                    onClick: () => {
                      clearTokenSnapshot();
                      message.info('已清除本地令牌');
                    },
                  },
                ],
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className="user-avatar-btn">
                <div className="user-avatar-circle">{avatarChar}</div>
                <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
                  {tokenSnapshot.userId}
                </Typography.Text>
              </div>
            </Dropdown>
          ) : (
            <Button
              type="primary"
              icon={<UserOutlined />}
              onClick={() => setLoginOpen(true)}
              style={{
                borderRadius: 'var(--radius-xl)',
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
              }}
            >
              登录
            </Button>
          )}
        </div>
      </Header>

      {/* 主内容区 —— 铺满 Header 以下所有空间 */}
      <Content style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </Content>

      {/* 登录弹窗 —— 美化 */}
      <Modal
        title={
          <Space>
            <SafetyOutlined style={{ color: 'var(--color-primary)' }} />
            <span>获取开发令牌</span>
          </Space>
        }
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
        className="login-modal"
        width={420}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, fontSize: 13 }}>
          开发联调专用，调用公开接口签发 JWT。生产环境将接入正式账号体系。
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
            <Input
              prefix={<UserOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="例如：user-001"
              autoFocus
              maxLength={64}
              size="large"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
