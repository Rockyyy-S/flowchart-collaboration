import { useMemo, useState } from 'react';
import {
  Button,
  Collapse,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  DoubleLeftOutlined,
  DoubleRightOutlined,
  FolderOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProjects } from '../../api/projects';
import { createProject } from '../../api/projects';
import { updateFlowDraft } from '../../api/flows';
import { getAccessToken } from '../../auth/token';
import type { ProjectListItem, ProjectSummary } from '../../api/types';

const { Text } = Typography;

/** localStorage 存储键（兜底用） */
const STORAGE_KEY = 'flowkit_projects';

/** 预设演示项目流程 */
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

/** 从 localStorage 读取项目列表（降级兜底） */
function loadLocalProjects(): ProjectSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProjectSummary[]) : [];
  } catch {
    return [];
  }
}

/** 持久化项目列表到 localStorage */
function saveLocalProjects(projects: ProjectSummary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/** 按进度状态分类项目 */
function classifyByProgress(items: ProjectListItem[]) {
  const notStarted: ProjectListItem[] = [];
  const inProgress: ProjectListItem[] = [];
  const completed: ProjectListItem[] = [];

  for (const item of items) {
    const { totalNodes, completedNodes, inProgressNodes } = item.progress;
    if (totalNodes > 0 && completedNodes === totalNodes) {
      completed.push(item);
    } else if (inProgressNodes > 0 || (completedNodes > 0 && completedNodes < totalNodes)) {
      inProgress.push(item);
    } else {
      notStarted.push(item);
    }
  }

  return { notStarted, inProgress, completed };
}

/** 进度文字描述 */
function progressText(item: ProjectListItem): string {
  const { totalNodes, completedNodes } = item.progress;
  if (totalNodes === 0) return '暂无节点';
  return `${completedNodes}/${totalNodes} 已完成`;
}

interface ProjectListPanelProps {
  /** 当前选中的项目 ID */
  selectedProjectId: string | null;
  /** 选中项目回调 */
  onSelectProject: (projectId: string, role: 'OWNER' | 'MEMBER' | 'VIEWER') => void;
  /** 面板是否折叠 */
  collapsed: boolean;
  /** 切换折叠 */
  onToggleCollapse: () => void;
}

/**
 * 左侧项目列表面板
 *
 * 按"我负责的 / 我参与的"分大类，再按"未开始 / 进行中 / 已完成"分子类。
 * 已登录时调 GET /api/v1/projects；未登录时降级读 localStorage。
 */
export default function ProjectListPanel({
  selectedProjectId,
  onSelectProject,
  collapsed,
  onToggleCollapse,
}: ProjectListPanelProps) {
  const queryClient = useQueryClient();
  const hasToken = !!getAccessToken();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<{ name: string }>();

  /* 从后端获取项目列表 */
  const { data: remoteProjects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getMyProjects,
    enabled: hasToken,
    staleTime: 15000,
  });

  /* 按角色和进度分类 */
  const { owned, participated, localFallback } = useMemo(() => {
    if (remoteProjects && remoteProjects.length > 0) {
      const ownedList = remoteProjects.filter((p) => p.role === 'OWNER');
      const participatedList = remoteProjects.filter((p) => p.role !== 'OWNER');
      return {
        owned: classifyByProgress(ownedList),
        participated: classifyByProgress(participatedList),
        localFallback: null,
      };
    }
    /* 未登录或无远端数据时降级读 localStorage */
    return {
      owned: null,
      participated: null,
      localFallback: loadLocalProjects(),
    };
  }, [remoteProjects]);

  /** 创建演示项目 */
  async function handleCreateDemo() {
    if (creating) return;
    setCreating(true);
    try {
      const project = await createProject('示例研发项目');
      await updateFlowDraft(project.projectId, DEMO_FLOW);
      message.success('演示项目已创建');
      /* 更新 localStorage 兜底 */
      const local = loadLocalProjects();
      saveLocalProjects([
        { projectId: project.projectId, name: project.name, createdAt: project.createdAt },
        ...local,
      ]);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSelectProject(project.projectId, 'OWNER');
    } catch {
      /* 错误由拦截器处理 */
    } finally {
      setCreating(false);
    }
  }

  /** 创建自定义项目 */
  async function handleCreateProject() {
    if (creating) return;
    try {
      const values = await form.validateFields();
      setCreating(true);
      const project = await createProject(values.name.trim());
      /* 初始化单节点草稿 */
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
      const local = loadLocalProjects();
      saveLocalProjects([
        { projectId: project.projectId, name: project.name, createdAt: project.createdAt },
        ...local,
      ]);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSelectProject(project.projectId, 'OWNER');
      setCreateModalOpen(false);
      form.resetFields();
    } catch {
      /* 错误由拦截器处理 */
    } finally {
      setCreating(false);
    }
  }

  /** 渲染单个项目条目 */
  function renderProjectItem(item: ProjectListItem) {
    const isSelected = selectedProjectId === item.projectId;
    return (
      <div
        key={item.projectId}
        className={`project-list-item ${isSelected ? 'project-list-item--active' : ''}`}
        onClick={() => onSelectProject(item.projectId, item.role)}
        role="button"
        tabIndex={0}
      >
        <FolderOutlined style={{ flexShrink: 0, color: isSelected ? '#1677ff' : '#8c8c8c' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            ellipsis={{ tooltip: item.name }}
            strong={isSelected}
            style={{ fontSize: 13, display: 'block', lineHeight: '20px' }}
          >
            {item.name}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {progressText(item)}
          </Text>
        </div>
      </div>
    );
  }

  /** 渲染子分类折叠项 */
  function renderSubCategory(
    label: string,
    items: ProjectListItem[],
    key: string,
  ) {
    if (items.length === 0) return null;
    return {
      key,
      label: (
        <Space size={4}>
          <Text style={{ fontSize: 12 }}>{label}</Text>
          <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{items.length}</Tag>
        </Space>
      ),
      children: <div>{items.map(renderProjectItem)}</div>,
    };
  }

  /** 渲染已分类的大类 */
  function renderCategory(
    title: string,
    classified: ReturnType<typeof classifyByProgress>,
    keyPrefix: string,
  ) {
    const subItems = [
      renderSubCategory('进行中', classified.inProgress, `${keyPrefix}-progress`),
      renderSubCategory('未开始', classified.notStarted, `${keyPrefix}-notstarted`),
      renderSubCategory('已完成', classified.completed, `${keyPrefix}-completed`),
    ].filter(Boolean) as Array<{ key: string; label: React.ReactNode; children: React.ReactNode }>;

    if (subItems.length === 0) return null;

    return (
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11, padding: '4px 12px', display: 'block' }}>
          {title}
        </Text>
        <Collapse
          ghost
          size="small"
          defaultActiveKey={subItems.map((s) => s.key)}
          items={subItems}
        />
      </div>
    );
  }

  /* 折叠态：仅显示展开按钮 */
  if (collapsed) {
    return (
      <div className="project-list-panel project-list-panel--collapsed">
        <Tooltip title="展开项目列表" placement="right">
          <Button
            type="text"
            icon={<DoubleRightOutlined />}
            onClick={onToggleCollapse}
            style={{ width: '100%' }}
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="project-list-panel">
      {/* 顶部操作栏 */}
      <div className="project-list-panel__header">
        <Space size={4} style={{ flex: 1 }}>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            disabled={creating}
            onClick={() => setCreateModalOpen(true)}
          >
            新建
          </Button>
          <Button
            size="small"
            icon={<RocketOutlined />}
            loading={creating}
            onClick={handleCreateDemo}
          >
            快速体验
          </Button>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<DoubleLeftOutlined />}
          onClick={onToggleCollapse}
        />
      </div>

      {/* 项目列表内容 */}
      <div className="project-list-panel__body">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size="small" />
          </div>
        ) : owned && participated ? (
          <>
            {renderCategory('我负责的项目', owned, 'owned')}
            {renderCategory('我参与的项目', participated, 'participated')}
            {owned.notStarted.length === 0 &&
              owned.inProgress.length === 0 &&
              owned.completed.length === 0 &&
              participated.notStarted.length === 0 &&
              participated.inProgress.length === 0 &&
              participated.completed.length === 0 && (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无项目"
                  style={{ padding: '24px 0' }}
                />
              )}
          </>
        ) : localFallback && localFallback.length > 0 ? (
          /* 降级：未登录时显示 localStorage 中的项目 */
          <div>
            <Text type="secondary" style={{ fontSize: 11, padding: '4px 12px', display: 'block' }}>
              本地缓存项目
            </Text>
            {localFallback.map((p) => (
              <div
                key={p.projectId}
                className={`project-list-item ${selectedProjectId === p.projectId ? 'project-list-item--active' : ''}`}
                onClick={() => onSelectProject(p.projectId, 'OWNER')}
                role="button"
                tabIndex={0}
              >
                <FolderOutlined style={{ flexShrink: 0, color: '#8c8c8c' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis={{ tooltip: p.name }}
                    style={{ fontSize: 13, display: 'block' }}
                  >
                    {p.name}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无项目，请新建或快速体验"
            style={{ padding: '24px 0' }}
          />
        )}
      </div>

      {/* 新建项目弹窗 */}
      <Modal
        title="新建项目"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={handleCreateProject}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="项目名称"
            name="name"
            rules={[
              { required: true, message: '请输入项目名称' },
              { min: 2, message: '名称至少 2 个字符' },
              { max: 50, message: '名称不超过 50 个字符' },
            ]}
          >
            <Input placeholder="例如：Q2 产品迭代" autoFocus maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
