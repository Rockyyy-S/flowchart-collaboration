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
  CrownOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  InboxOutlined,
  PlusOutlined,
  RocketOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProjects } from '../../api/projects';
import { createProject } from '../../api/projects';
import { updateFlowDraft } from '../../api/flows';
import { getAccessToken } from '../../auth/token';
import type { ProjectListItem } from '../../api/types';

const { Text } = Typography;

/** localStorage 存储键（兜底用） */
const STORAGE_KEY = 'flowkit_projects';

/** 预设演示项目流程 */
const DEMO_FLOW = {
  graphJson: {
    nodes: [
      { id: 'node-req', text: '需求评审', type: 'START' as const },
      { id: 'node-tech', text: '技术方案评审' },
      { id: 'node-dev', text: '开发' },
      { id: 'node-qa', text: '测试验收' },
      { id: 'node-deploy', text: '发布上线', type: 'END' as const },
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
      type: 'START',
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
      type: 'END',
      requiredArtifacts: [
        { id: 'art-release-checklist', name: '发布清单', required: false },
      ],
      predecessorNodeIds: ['node-qa'],
    },
  ],
};

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

/** 进度文字描述 + 进度颜色 */
function progressText(item: ProjectListItem): string {
  const { totalNodes, completedNodes } = item.progress;
  if (totalNodes === 0) return '暂无节点';
  return `${completedNodes}/${totalNodes} 已完成`;
}

/** 进度状态颜色 */
function progressColor(item: ProjectListItem): string {
  const { totalNodes, completedNodes, inProgressNodes } = item.progress;
  if (totalNodes > 0 && completedNodes === totalNodes) return 'var(--color-success)';
  if (inProgressNodes > 0) return 'var(--color-warning)';
  return 'var(--color-text-muted)';
}

interface ProjectListPanelProps {
  /** 当前选中的项目 ID */
  selectedProjectId: string | null;
  /** 选中项目回调 */
  onSelectProject: (projectId: string, role: 'OWNER' | 'MEMBER' | 'VIEWER', initialMode?: 'view' | 'edit') => void;
  /** 面板是否折叠 */
  collapsed: boolean;
  /** 切换折叠 */
  onToggleCollapse: () => void;
}

/**
 * 左侧项目列表面板
 *
 * 按"我负责的 / 我参与的"分大类，再按"未开始项目 / 未完成项目 / 已完成项目"分子类。
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
  const { owned, participated } = useMemo(() => {
    const projects = remoteProjects ?? [];
    const ownedList = projects.filter((p) => p.role === 'OWNER');
    const participatedList = projects.filter((p) => p.role !== 'OWNER');
    return {
      owned: classifyByProgress(ownedList),
      participated: classifyByProgress(participatedList),
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
      saveLocalProjects([
        { projectId: project.projectId, name: project.name, createdAt: project.createdAt },
      ]);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSelectProject(project.projectId, 'OWNER', 'edit');
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
          nodes: [{ id: 'node-start', text: '起始节点', type: 'START' as const }],
          edges: [],
        },
        nodesConfig: [
          {
            nodeId: 'node-start',
            name: '起始节点',
            type: 'START',
            requiredArtifacts: [],
            predecessorNodeIds: [],
          },
        ],
      });
      message.success('项目已创建');
      saveLocalProjects([
        { projectId: project.projectId, name: project.name, createdAt: project.createdAt },
      ]);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSelectProject(project.projectId, 'OWNER', 'edit');
      setCreateModalOpen(false);
      form.resetFields();
    } catch {
      /* 错误由拦截器处理 */
    } finally {
      setCreating(false);
    }
  }

  /** 渲染单个项目条目 —— 增强悬停效果 */
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
        {isSelected
          ? <FolderOpenOutlined style={{ flexShrink: 0, color: 'var(--color-primary)', fontSize: 15 }} />
          : <FolderOutlined style={{ flexShrink: 0, color: 'var(--color-text-muted)', fontSize: 15 }} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            ellipsis={{ tooltip: item.name }}
            strong={isSelected}
            style={{ fontSize: 13, display: 'block', lineHeight: '20px', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)' }}
          >
            {item.name}
          </Text>
          <Text style={{ fontSize: 11, color: progressColor(item) }}>
            {progressText(item)}
          </Text>
        </div>
      </div>
    );
  }

  /** 渲染子分类折叠项 —— 带图标和计数标签 */
  function renderSubCategory(
    label: string,
    items: ProjectListItem[],
    key: string,
  ) {
    /* 子分类对应图标 */
    const iconMap: Record<string, React.ReactNode> = {
      '未开始项目': <InboxOutlined style={{ color: 'var(--color-text-muted)', fontSize: 12 }} />,
      '未完成项目': <ThunderboltOutlined style={{ color: 'var(--color-warning)', fontSize: 12 }} />,
      '已完成项目': <FolderOpenOutlined style={{ color: 'var(--color-success)', fontSize: 12 }} />,
    };
    return {
      key,
      label: (
        <Space size={4}>
          {iconMap[label]}
          <Text style={{ fontSize: 12, fontWeight: 500 }}>{label}</Text>
          <Tag
            style={{
              fontSize: 10,
              lineHeight: '16px',
              padding: '0 5px',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            {items.length}
          </Tag>
        </Space>
      ),
      children: items.length > 0
        ? <div>{items.map(renderProjectItem)}</div>
        : <Text style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 12px', display: 'block' }}>暂无项目</Text>,
    };
  }

  /** 渲染已分类的大类 —— 带角色图标 */
  function renderCategory(
    title: string,
    classified: ReturnType<typeof classifyByProgress>,
    keyPrefix: string,
  ) {
    const subItems = [
      renderSubCategory('未开始项目', classified.notStarted, `${keyPrefix}-notstarted`),
      renderSubCategory('未完成项目', classified.inProgress, `${keyPrefix}-progress`),
      renderSubCategory('已完成项目', classified.completed, `${keyPrefix}-completed`),
    ];

    const icon = keyPrefix === 'owned'
      ? <CrownOutlined style={{ fontSize: 12, color: 'var(--color-warning)' }} />
      : <TeamOutlined style={{ fontSize: 12, color: 'var(--color-info)' }} />;

    return (
      <div style={{ marginBottom: 8 }}>
        <div className="project-category-title">
          {icon}
          <span>{title}</span>
        </div>
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
        <Space size={6} style={{ flex: 1 }}>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            disabled={creating}
            onClick={() => setCreateModalOpen(true)}
            style={{ borderRadius: 'var(--radius-sm)', fontWeight: 500 }}
          >
            新建
          </Button>
          <Button
            size="small"
            icon={<RocketOutlined />}
            loading={creating}
            onClick={handleCreateDemo}
            style={{ borderRadius: 'var(--radius-sm)' }}
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
        ) : (
          <>
            {renderCategory('我负责的项目', owned, 'owned')}
            {renderCategory('我参与的项目', participated, 'participated')}
          </>
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
