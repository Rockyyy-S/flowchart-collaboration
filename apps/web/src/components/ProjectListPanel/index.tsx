/**
 * 左侧项目列表面板（重构版）
 *
 * 改动要点：
 * 1. 点击项目展开该项目下的流程图列表（调用 GET /projects/:id/flowcharts）
 * 2. 点击流程图触发 onOpenFlowchart 回调（在画布区域新开标签）
 * 3. 新建项目表单新增团队绑定（必填）和同时创建流程图（可选，默认开）
 * 4. 项目列表每条显示所属团队 ID
 * 5. OWNER 项目显示删除按钮，点击二次确认
 */
import { useMemo, useState } from 'react';
import {
  Button,
  Collapse,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CrownOutlined,
  DeleteOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  InboxOutlined,
  PlusOutlined,
  RocketOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProjects, createProject, deleteProject } from '../../api/projects';
import { createFlowchart, getProjectFlowcharts } from '../../api/flowcharts';
import { getMyTeams } from '../../api/teams';
import { updateFlowDraft } from '../../api/flows';
import { getAccessToken } from '../../auth/token';
import type { Flowchart, ProjectListItem, ProjectSummary } from '../../api/types';

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

/** 流程图状态标签配置 */
const FLOWCHART_STATUS_MAP = {
  0: { label: '未开始', color: 'default' },
  1: { label: '进行中', color: 'processing' },
  2: { label: '已完成', color: 'success' },
  3: { label: '超时', color: 'error' },
} as const;

/** 创建项目表单字段 */
interface CreateProjectFormValues {
  name: string;
  teamId: string;
  createFlowchart: boolean;
  flowchartName?: string;
}

/** onOpenFlowchart 回调参数（导出供 MainWorkspace 使用） */
export interface OpenFlowchartInfo {
  projectId: string;
  projectName: string;
  projectRole: 'OWNER' | 'MEMBER' | 'VIEWER';
  flowchartId: string;
  flowchartName: string;
}

interface ProjectListPanelProps {
  /** 当前激活的流程图 ID（用于高亮标记） */
  activeFlowchartId: string | null;
  /** 打开流程图标签页回调 */
  onOpenFlowchart: (info: OpenFlowchartInfo) => void;
  /** 面板是否折叠 */
  collapsed: boolean;
  /** 切换折叠 */
  onToggleCollapse: () => void;
}

/**
 * 左侧项目列表面板
 */
export default function ProjectListPanel({
  activeFlowchartId,
  onOpenFlowchart,
  collapsed,
  onToggleCollapse,
}: ProjectListPanelProps) {
  const queryClient = useQueryClient();
  const hasToken = !!getAccessToken();

  /* 展开了哪个项目的流程图列表 */
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  /* 新建项目弹窗 */
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createFlowchartEnabled, setCreateFlowchartEnabled] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<CreateProjectFormValues>();

  /* 从后端获取项目列表 */
  const { data: remoteProjects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getMyProjects,
    enabled: hasToken,
    staleTime: 15000,
  });

  /* 获取当前用户团队列表（用于创建项目时选择） */
  const { data: myTeams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: getMyTeams,
    enabled: hasToken && createModalOpen,
    staleTime: 15000,
  });

  /* 展开项目时拉取其流程图列表 */
  const { data: projectFlowcharts, isLoading: flowchartsLoading } = useQuery({
    queryKey: ['flowcharts', expandedProjectId],
    queryFn: () => getProjectFlowcharts(expandedProjectId!),
    enabled: !!expandedProjectId,
    staleTime: 15000,
  });

  /* 删除项目 mutation */
  const deleteProjMut = useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      message.success('项目已删除');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  /* 按角色和进度分类 */
  const { owned, participated } = useMemo(() => {
    const ownedList = remoteProjects.filter((p) => p.role === 'OWNER');
    const participatedList = remoteProjects.filter((p) => p.role !== 'OWNER');
    return { owned: classifyByProgress(ownedList), participated: classifyByProgress(participatedList) };
  }, [remoteProjects]);

  /** 切换展开/收起某个项目的流程图列表 */
  function toggleExpandProject(projectId: string) {
    setExpandedProjectId((prev) => (prev === projectId ? null : projectId));
  }

  /** 快速体验：自动选第一个可用团队创建演示项目 */
  async function handleCreateDemo() {
    if (creating) return;
    const teams = await getMyTeams().catch(() => []);
    if (teams.length === 0) {
      message.warning('请先在「团队管理」中创建团队，再创建项目');
      return;
    }
    setCreating(true);
    try {
      const project = await createProject('示例研发项目', teams[0].id);
      await updateFlowDraft(project.projectId, DEMO_FLOW);
      let flowchart: Flowchart | null = null;
      try {
        flowchart = await createFlowchart(project.projectId, { name: '主流程图' });
      } catch {
        // 流程图创建失败不阻断
      }
      message.success('演示项目已创建');
      saveLocalProjects([{ projectId: project.projectId, name: project.name, createdAt: project.createdAt }]);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (flowchart) {
        onOpenFlowchart({
          projectId: project.projectId, projectName: project.name,
          projectRole: 'OWNER', flowchartId: flowchart.id, flowchartName: flowchart.name,
        });
      }
    } catch {
      // 错误由拦截器处理
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
      const project = await createProject(values.name.trim(), values.teamId);
      await updateFlowDraft(project.projectId, {
        graphJson: {
          nodes: [{ id: 'node-start', text: '起始节点', type: 'START' as const }],
          edges: [],
        },
        nodesConfig: [{
          nodeId: 'node-start', name: '起始节点', type: 'START' as const,
          requiredArtifacts: [], predecessorNodeIds: [],
        }],
      });
      let flowchart: Flowchart | null = null;
      if (values.createFlowchart && values.flowchartName?.trim()) {
        try {
          flowchart = await createFlowchart(project.projectId, { name: values.flowchartName.trim() });
        } catch {
          message.warning('项目已创建，但流程图创建失败，可稍后手动创建');
        }
      }
      message.success('项目已创建');
      saveLocalProjects([{ projectId: project.projectId, name: project.name, createdAt: project.createdAt }]);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (flowchart) {
        onOpenFlowchart({
          projectId: project.projectId, projectName: project.name,
          projectRole: 'OWNER', flowchartId: flowchart.id, flowchartName: flowchart.name,
        });
      } else {
        setExpandedProjectId(project.projectId);
      }
      setCreateModalOpen(false);
      form.resetFields();
      setCreateFlowchartEnabled(true);
    } catch {
      // 错误由拦截器处理
    } finally {
      setCreating(false);
    }
  }

  /** 渲染单个流程图条目 */
  function renderFlowchartItem(flowchart: Flowchart, projectItem: ProjectListItem) {
    const isActive = activeFlowchartId === flowchart.id;
    const statusCfg = FLOWCHART_STATUS_MAP[flowchart.status] ?? FLOWCHART_STATUS_MAP[0];
    return (
      <div
        key={flowchart.id}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px 6px 28px', cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          background: isActive ? 'var(--color-primary-bg)' : 'transparent',
          marginBottom: 2, transition: 'background var(--transition-fast)',
        }}
        onClick={() => onOpenFlowchart({
          projectId: projectItem.projectId, projectName: projectItem.name,
          projectRole: projectItem.role, flowchartId: flowchart.id, flowchartName: flowchart.name,
        })}
        role="button"
        tabIndex={0}
      >
        <FileTextOutlined style={{ fontSize: 12, color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0 }} />
        <Text ellipsis={{ tooltip: flowchart.name }} style={{
          fontSize: 12, flex: 1,
          color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          fontWeight: isActive ? 600 : 400,
        }}>
          {flowchart.name}
        </Text>
        <Tag color={statusCfg.color} style={{ fontSize: 10, padding: '0 4px', flexShrink: 0 }}>
          {statusCfg.label}
        </Tag>
      </div>
    );
  }

  /** 渲染单个项目条目 */
  function renderProjectItem(item: ProjectListItem) {
    const isExpanded = expandedProjectId === item.projectId;
    const isOwner = item.role === 'OWNER';
    return (
      <div key={item.projectId}>
        <div
          className={`project-list-item ${isExpanded ? 'project-list-item--active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => toggleExpandProject(item.projectId)}
          role="button"
          tabIndex={0}
        >
          {isExpanded
            ? <FolderOpenOutlined style={{ flexShrink: 0, color: 'var(--color-primary)', fontSize: 15 }} />
            : <FolderOutlined style={{ flexShrink: 0, color: 'var(--color-text-muted)', fontSize: 15 }} />
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text ellipsis={{ tooltip: item.name }} strong={isExpanded} style={{
              fontSize: 13, display: 'block', lineHeight: '20px',
              color: isExpanded ? 'var(--color-primary)' : 'var(--color-text-primary)',
            }}>
              {item.name}
            </Text>
            <Space size={4}>
              <Text style={{ fontSize: 11, color: progressColor(item) }}>{progressText(item)}</Text>
              {item.teamId && (
                <Tag style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>{item.teamId}</Tag>
              )}
            </Space>
          </div>
          {/* 仅 OWNER 显示删除按钮 */}
          {isOwner && (
            <Popconfirm
              title="确定删除项目？"
              description="删除后该项目下所有流程图将同步删除，不可恢复。"
              onConfirm={(e) => { e?.stopPropagation(); deleteProjMut.mutate(item.projectId); }}
              onCancel={(e) => e?.stopPropagation()}
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text" size="small" danger icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
                style={{ flexShrink: 0, opacity: 0.6 }}
              />
            </Popconfirm>
          )}
        </div>
        {/* 流程图子列表 */}
        {isExpanded && (
          <div style={{ marginTop: 4 }}>
            {flowchartsLoading ? (
              <div style={{ padding: '8px 28px' }}><Spin size="small" /></div>
            ) : (projectFlowcharts ?? []).length === 0 ? (
              <Text style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 28px', display: 'block' }}>
                暂无流程图
              </Text>
            ) : (
              (projectFlowcharts ?? []).map((fc) => renderFlowchartItem(fc, item))
            )}
          </div>
        )}
      </div>
    );
  }

  /** 渲染子分类折叠项 */
  function renderSubCategory(
    label: string,
    items: ProjectListItem[],
    key: string,
  ) {
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

  /** 渲染大类分组 */
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
      ? <CrownOutlined style={{ fontSize: 16, color: 'var(--color-warning)' }} />
      : <TeamOutlined style={{ fontSize: 16, color: 'var(--color-info)' }} />;
    return (
      <div style={{ marginBottom: 8 }}>
        <div className="project-category-title">
          {icon}
          <span>{title}</span>
        </div>
        <Collapse ghost size="small" defaultActiveKey={subItems.map((s) => s.key)} items={subItems} />
      </div>
    );
  }

  /* 折叠态 */
  if (collapsed) {
    return (
      <div className="project-list-panel project-list-panel--collapsed">
        <Tooltip title="展开项目列表" placement="right">
          <Button type="text" icon={<DoubleRightOutlined />} onClick={onToggleCollapse} style={{ width: '100%' }} />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="project-list-panel">
      {/* 顶部操作区 */}
      <div className="project-list-panel__header">
        <Button
          type="primary" icon={<PlusOutlined />} disabled={creating}
          onClick={() => setCreateModalOpen(true)}
          style={{ borderRadius: 'var(--radius-sm)', fontWeight: 500, flex: 1 }}
        >
          新建
        </Button>
        <Button icon={<RocketOutlined />} loading={creating} onClick={handleCreateDemo}
          style={{ borderRadius: 'var(--radius-sm)', flex: 1 }}>
          快速体验
        </Button>
        <Button type="text" size="small" className="project-list-panel__collapse-btn"
          icon={<DoubleLeftOutlined />} onClick={onToggleCollapse} />
      </div>

      {/* 项目列表内容 */}
      <div className="project-list-panel__body">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>
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
          setCreateFlowchartEnabled(true);
        }}
        onOk={handleCreateProject}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        destroyOnClose
        width={460}
      >
        <Form form={form} layout="vertical" initialValues={{ createFlowchart: true, flowchartName: '主流程图' }}>
          {/* 项目名称 */}
          <Form.Item
            label="项目名称" name="name"
            rules={[
              { required: true, message: '请输入项目名称' },
              { min: 2, message: '名称至少 2 个字符' },
              { max: 50, message: '名称不超过 50 个字符' },
            ]}
          >
            <Input placeholder="例如：Q2 产品迭代" autoFocus maxLength={50} />
          </Form.Item>

          {/* 绑定团队（必填） */}
          <Form.Item
            label="绑定团队" name="teamId"
            rules={[{ required: true, message: '请选择绑定的团队' }]}
            extra="项目必须属于一个团队，该团队成员将可查看此项目"
          >
            <Select
              placeholder="请选择团队"
              options={myTeams.map((t) => ({ value: t.id, label: `${t.name}（${t.memberIds.length} 人）` }))}
              notFoundContent={<Text type="secondary" style={{ fontSize: 12 }}>暂无团队，请先在「团队管理」中创建</Text>}
            />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          {/* 同时创建流程图 */}
          <Form.Item label="同时创建流程图" name="createFlowchart" valuePropName="checked">
            <Switch
              checked={createFlowchartEnabled}
              onChange={(checked) => {
                setCreateFlowchartEnabled(checked);
                form.setFieldValue('createFlowchart', checked);
              }}
            />
          </Form.Item>

          {createFlowchartEnabled && (
            <Form.Item
              label="流程图名称" name="flowchartName"
              rules={[
                { required: true, message: '请输入流程图名称' },
                { max: 50, message: '名称不超过 50 个字符' },
              ]}
            >
              <Input placeholder="例如：主流程图" maxLength={50} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
