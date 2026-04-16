import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  PlusOutlined,
  RocketOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { createProject } from '../api/projects';
import { updateFlowDraft } from '../api/flows';
import { getAccessToken, subscribeTokenChange } from '../auth/token';
import type { ProjectSummary } from '../api/types';

const { Title, Text, Paragraph } = Typography;

/** localStorage 存储键 */
const STORAGE_KEY = 'flowkit_projects';

/** 预设演示项目流程（研发标准交付流程） */
const DEMO_FLOW = {
  graphJson: {
    nodes: [
      { id: 'node-req', text: '需求评审' },
      { id: 'node-tech', text: '技术方案评审' },
      { id: 'node-dev', text: '开发' },
      { id: 'node-qa', text: '测试验收' },
      { id: 'node-deploy', text: '发布上线' },
    ],
    edges: [
      { source: 'node-req', target: 'node-tech' },
      { source: 'node-tech', target: 'node-dev' },
      { source: 'node-dev', target: 'node-qa' },
      { source: 'node-qa', target: 'node-deploy' },
    ],
  },
  nodesConfig: [
    {
      nodeId: 'node-req',
      name: '需求评审',
      requiredArtifacts: [
        { id: 'art-prd', name: '产品需求文档(PRD)', required: true },
      ],
      predecessorNodeIds: [],
    },
    {
      nodeId: 'node-tech',
      name: '技术方案评审',
      requiredArtifacts: [
        { id: 'art-tech-doc', name: '技术方案文档', required: true },
      ],
      predecessorNodeIds: ['node-req'],
    },
    {
      nodeId: 'node-dev',
      name: '开发',
      requiredArtifacts: [
        { id: 'art-code-review', name: '代码评审报告', required: true },
      ],
      predecessorNodeIds: ['node-tech'],
    },
    {
      nodeId: 'node-qa',
      name: '测试验收',
      requiredArtifacts: [
        { id: 'art-test-report', name: '测试报告', required: true },
      ],
      predecessorNodeIds: ['node-dev'],
    },
    {
      nodeId: 'node-deploy',
      name: '发布上线',
      requiredArtifacts: [
        { id: 'art-release-checklist', name: '发布清单', required: false },
      ],
      predecessorNodeIds: ['node-qa'],
    },
  ],
};

/** 从 localStorage 读取项目列表 */
function loadProjects(): ProjectSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProjectSummary[]) : [];
  } catch {
    return [];
  }
}

/** 持久化项目列表到 localStorage */
function saveProjects(projects: ProjectSummary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/**
 * 项目工作台页面
 * - 展示已创建项目列表
 * - 支持新建空白项目
 * - 支持一键创建演示项目（含预设流程）
 */
export default function WorkbenchPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>(loadProjects);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form] = Form.useForm<{ name: string }>();
  const [hasToken, setHasToken] = useState(() => !!getAccessToken());
  const creating = demoLoading || formLoading;

  // 当 projects 变化时同步到 localStorage
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    return subscribeTokenChange(() => {
      setHasToken(!!getAccessToken());
    });
  }, []);

  /** 将新项目追加到列表并跳转 */
  function addAndNavigate(summary: ProjectSummary) {
    setProjects((prev) => [summary, ...prev]);
    navigate(`/projects/${summary.projectId}`);
  }

  /** 创建演示项目（含预设研发流程） */
  async function handleCreateDemo() {
    if (creating) {
      return;
    }

    setDemoLoading(true);
    try {
      const project = await createProject('示例研发项目');
      await updateFlowDraft(project.projectId, DEMO_FLOW);
      message.success('演示项目已创建，正在进入工作台…');
      addAndNavigate({
        projectId: project.projectId,
        name: project.name,
        createdAt: project.createdAt,
      });
    } catch {
      // 错误由 apiClient 拦截器统一提示
    } finally {
      setDemoLoading(false);
    }
  }

  /** 创建自定义空白项目 */
  async function handleCreateBlank() {
    if (creating) {
      return;
    }

    try {
      const values = await form.validateFields();
      setFormLoading(true);
      const project = await createProject(values.name.trim());
      // 空白项目也初始化一个单节点示意草稿
      await updateFlowDraft(project.projectId, {
        graphJson: {
          nodes: [{ id: 'node-start', text: '起始节点' }],
          edges: [],
        },
        nodesConfig: [
          {
            nodeId: 'node-start',
            name: '起始节点',
            requiredArtifacts: [],
            predecessorNodeIds: [],
          },
        ],
      });
      message.success('项目已创建');
      addAndNavigate({
        projectId: project.projectId,
        name: project.name,
        createdAt: project.createdAt,
      });
      setCreateModalOpen(false);
      form.resetFields();
    } catch {
      // 验证失败或 API 错误由拦截器处理
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div>
      {/* 页面标题 */}
      {!hasToken && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message="当前未登录，写操作会被拦截"
          description="请先在右上角点击“获取开发令牌”，再创建项目或提交流程。"
        />
      )}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            项目工作台
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            管理你的流程驱动项目，逐节点推进并追踪文档门禁
          </Text>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            icon={<RocketOutlined />}
            onClick={handleCreateDemo}
            loading={demoLoading}
            disabled={creating}
          >
            快速体验演示项目
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={creating}
            onClick={() => setCreateModalOpen(true)}
          >
            新建项目
          </Button>
        </div>
      </div>

      {/* 演示引导横幅（仅无项目时显示） */}
      {projects.length === 0 && (
        <Card
          style={{
            background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)',
            border: '1.5px solid #91caff',
            marginBottom: 24,
            borderRadius: 12,
          }}
        >
          <div className="flex items-start gap-4 flex-wrap">
            <RocketOutlined style={{ fontSize: 36, color: '#1677ff', flexShrink: 0, marginTop: 4 }} />
            <div className="flex-1 min-w-0">
              <Title level={5} style={{ margin: '0 0 4px' }}>
                首次使用？点击「快速体验演示项目」
              </Title>
              <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
                系统将自动创建一个包含 5 节点研发流程的示例项目，让你快速体验
                <strong>「节点提交失败 → 提示缺项 → 上传并绑定 → 再次提交通过」</strong>的完整闭环。
              </Paragraph>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              loading={demoLoading}
              disabled={creating}
              onClick={handleCreateDemo}
            >
              一键体验
            </Button>
          </div>
        </Card>
      )}

      {/* 项目列表 */}
      {projects.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无项目，点击上方「新建项目」或「快速体验演示项目」开始"
          style={{ padding: '48px 0' }}
        />
      ) : (
        <Spin spinning={false}>
          <Row gutter={[16, 16]}>
            {projects.map((p) => (
              <Col key={p.projectId} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => navigate(`/projects/${p.projectId}`)}
                  style={{ borderRadius: 10 }}
                >
                  <div className="flex items-start gap-3">
                    <FolderOutlined
                      style={{ fontSize: 24, color: '#1677ff', flexShrink: 0, marginTop: 2 }}
                    />
                    <div className="min-w-0">
                      <Text strong className="block truncate" title={p.name}>
                        {p.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        创建于 {dayjs(p.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                      <div className="mt-2">
                        <Tag color="blue">活跃</Tag>
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Spin>
      )}

      {/* 新建项目弹窗 */}
      <Modal
        title="新建项目"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={handleCreateBlank}
        okText="创建"
        cancelText="取消"
        confirmLoading={formLoading}
        okButtonProps={{ disabled: creating }}
        cancelButtonProps={{ disabled: creating }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="项目名称"
            name="name"
            rules={[
              { required: true, message: '请输入项目名称' },
              { min: 2, message: '名称至少 2 个字符' },
              { max: 50, message: '名称不超过 50 个字符' },
            ]}
          >
            <Input
              placeholder="例如：Q3 商城改版项目"
              autoFocus
              maxLength={50}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
