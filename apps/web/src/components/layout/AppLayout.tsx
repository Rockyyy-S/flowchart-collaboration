import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Dropdown,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Popover,
  Space,
  Typography,
  message,
} from 'antd';
import {
  ApartmentOutlined,
  BellOutlined,
  LogoutOutlined,
  SafetyOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { issueDevToken } from '../../api/auth';
import {
  clearTokenSnapshot,
  getTokenSnapshot,
  setTokenSnapshot,
  subscribeTokenChange,
} from '../../auth/token';
import { OPEN_WORKSPACE_SEARCH_EVENT } from '../../constants/workspaceEvents';

const { Header, Content } = Layout;
const { Text } = Typography;

/** 顶部通知条目（MVP 使用本地列表，后续可替换为后端通知接口） */
const NOTIFICATIONS = [
  { id: 'n-1', unread: true, title: '需求评审节点已通过', desc: '项目A / 主流程图 · 2小时前' },
  { id: 'n-2', unread: true, title: '技术方案节点被回退', desc: '原因：评审文档不完整 · 5小时前' },
  { id: 'n-3', unread: false, title: '开发节点等待你开始', desc: '项目B / 功能流程 · 昨天' },
];

/**
 * 全局应用布局
 * - 顶部工具化导航栏（品牌 + 全局搜索 + 通知 + 用户菜单）
 * - 主内容区域铺满 Header 以下
 */
export default function AppLayout() {
  const [tokenSnapshot, setSnapshot] = useState(getTokenSnapshot);
  const [loginOpen, setLoginOpen] = useState(false);
  const [issuingToken, setIssuingToken] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [form] = Form.useForm<{ userId: string }>();
  const commandHint =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K';

  useEffect(() => {
    return subscribeTokenChange(() => {
      setSnapshot(getTokenSnapshot());
    });
  }, []);

  useEffect(() => {
    function emitWorkspaceSearch(query: string, source: 'header' | 'shortcut') {
      window.dispatchEvent(
        new CustomEvent(OPEN_WORKSPACE_SEARCH_EVENT, {
          detail: { query, source },
        }),
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isSearchShortcut) return;
      event.preventDefault();
      emitWorkspaceSearch(commandQuery, 'shortcut');
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandQuery]);

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
  const unreadCount = NOTIFICATIONS.filter((item) => item.unread).length;

  function emitWorkspaceSearch(query: string, source: 'header' | 'shortcut' = 'header') {
    window.dispatchEvent(
      new CustomEvent(OPEN_WORKSPACE_SEARCH_EVENT, {
        detail: { query, source },
      }),
    );
  }

  const notificationContent = (
    <div className="top-notification-popover">
      <div className="top-notification-popover__header">
        <div>
          <Text strong>通知中心</Text>
          <div className="top-notification-popover__meta">最近与流程推进相关的动态</div>
        </div>
        <Button type="link" size="small" style={{ padding: 0 }}>
          全部标为已读
        </Button>
      </div>
      <List
        size="small"
        dataSource={NOTIFICATIONS}
        renderItem={(item) => (
          <List.Item style={{ alignItems: 'flex-start', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                marginTop: 6,
                borderRadius: '50%',
                background: item.unread ? 'var(--color-primary)' : 'var(--color-text-muted)',
                flexShrink: 0,
              }}
            />
            <div>
              <Text style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{item.title}</Text>
              <br />
              <Text style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.desc}</Text>
            </div>
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Layout style={{ background: 'var(--color-bg-base)', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶部导航 —— 工具化工作区导航 */}
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
        <div className="app-header__section app-header__section--brand">
          <Link to="/" className="app-brand">
            <span className="app-brand__mark">
              <ApartmentOutlined className="app-brand__icon" />
            </span>
            <span className="app-brand__text-wrap">
              <span className="app-brand__text">Flowkit</span>
              <span className="app-brand__subtext">流程图驱动协作</span>
            </span>
          </Link>
        </div>

        {/* 顶部全局搜索（命令面板入口） */}
        <div className="app-header__section app-header__section--search">
          <Input
            value={commandQuery}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setCommandQuery(nextQuery);
              emitWorkspaceSearch(nextQuery);
            }}
            onFocus={() => emitWorkspaceSearch(commandQuery)}
            onPressEnter={() => emitWorkspaceSearch(commandQuery)}
            prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
            suffix={<span className="top-command-search__hint">{commandHint}</span>}
            placeholder="搜索节点、流程图、项目"
            size="middle"
            className="top-command-search"
          />
        </div>

        <div className="app-header__section app-header__section--actions">
          <Popover
            placement="bottomRight"
            trigger="click"
            content={notificationContent}
            overlayClassName="top-notification-popover-overlay"
          >
            <Button type="text" className="top-notification-btn">
              <Badge count={unreadCount} size="small">
                <BellOutlined style={{ fontSize: 18 }} />
              </Badge>
            </Button>
          </Popover>

          {/* 右侧用户区域 */}
          <div>
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
                      label: '切换开发令牌',
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
                <div className="user-avatar-btn" role="button" tabIndex={0}>
                  <div className="user-avatar-circle">{avatarChar}</div>
                  <div className="user-avatar-meta">
                    <Typography.Text className="user-avatar-name">
                      {tokenSnapshot.userId}
                    </Typography.Text>
                    <Typography.Text className="user-avatar-desc">
                      开发令牌已就绪
                    </Typography.Text>
                  </div>
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
                开发登录
              </Button>
            )}
          </div>
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
