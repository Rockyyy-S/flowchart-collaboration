/**
 * 主工作区页面（重构版）—— 三栏布局 + 多标签流程图
 *
 * 左侧：项目列表面板（240px，可折叠）——点击项目展开流程图列表，点击流程图打开标签
 * 中间：画布区域 —— 顶部多标签 + 下方 FlowCanvas（按当前激活标签的 projectId 加载数据）
 * 右侧：节点详情面板（360px，仅参与者点击节点时显示）
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Result, Skeleton, Space, Tabs, Typography, message } from 'antd';
import {
  AppstoreOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getExecutions } from '../api/executions';
import { getCurrentFlow, updateFlowDraft } from '../api/flows';
import { getAccessToken, getTokenSnapshot, subscribeTokenChange } from '../auth/token';
import ErrorBoundary from '../components/ErrorBoundary';
import FlowCanvas from '../components/FlowCanvas';
import NodeDetailPanel from '../components/NodeDetailPanel';
import ProjectListPanel from '../components/ProjectListPanel';
import type { OpenFlowchartInfo } from '../components/ProjectListPanel';
import type { NodeExecution, UpdateFlowDraftDto } from '../api/types';

const { Text } = Typography;

/** 已打开的流程图标签信息 */
interface OpenedFlowchart {
  flowchartId: string;
  projectId: string;
  projectName: string;
  flowchartName: string;
  projectRole: 'OWNER' | 'MEMBER' | 'VIEWER';
}

/**
 * 主工作区页面 —— 三栏布局 + 多标签
 */
export default function MainWorkspace() {
  const queryClient = useQueryClient();

  /* ── 令牌状态 ── */
  const [hasToken, setHasToken] = useState(() => !!getAccessToken());
  useEffect(() => {
    return subscribeTokenChange(() => setHasToken(!!getAccessToken()));
  }, []);

  /* ── 左侧面板状态 ── */
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  /* ── 多标签流程图状态 ── */
  const [openedFlowcharts, setOpenedFlowcharts] = useState<OpenedFlowchart[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);

  /* 当前激活的标签 */
  const activeTab = openedFlowcharts.find((t) => t.flowchartId === activeTabKey) ?? null;

  /* 当前激活的项目 ID（兼容现有 query key） */
  const selectedProjectId = activeTab?.projectId ?? null;
  const selectedProjectRole = activeTab?.projectRole ?? 'OWNER';

  /* ── 画布模式 ── */
  const [canvasMode, setCanvasMode] = useState<'view' | 'edit'>('view');

  /* ── 右侧面板：选中的节点执行实例 ── */
  const [selectedExecution, setSelectedExecution] = useState<NodeExecution | null>(null);

  /* ── 数据查询 ── */
  const {
    data: flowDefinition,
    isLoading: flowLoading,
    isError: flowError,
  } = useQuery({
    queryKey: ['flow', selectedProjectId],
    queryFn: () => getCurrentFlow(selectedProjectId!),
    enabled: !!selectedProjectId,
    staleTime: 30000,
  });

  const {
    data: executions = [],
    isLoading: execLoading,
  } = useQuery({
    queryKey: ['executions', selectedProjectId],
    queryFn: () => getExecutions(selectedProjectId!),
    enabled: !!selectedProjectId,
    refetchInterval: (query) => {
      const data = query.state.data as NodeExecution[] | undefined;
      return data?.some((e) => e.status === 'GATE_CHECKING') ? 2000 : false;
    },
  });

  /* 保存草稿 mutation */
  const saveDraftMut = useMutation({
    mutationFn: (dto: UpdateFlowDraftDto) => updateFlowDraft(selectedProjectId!, dto),
    onSuccess: () => {
      message.success('流程草稿已保存');
      queryClient.invalidateQueries({ queryKey: ['flow', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['executions', selectedProjectId] });
    },
  });

  /** 刷新全部数据 */
  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['executions', selectedProjectId] });
    queryClient.invalidateQueries({ queryKey: ['flow', selectedProjectId] });
  }

  /** 打开或激活流程图标签（从 ProjectListPanel 触发） */
  function handleOpenFlowchart(info: OpenFlowchartInfo) {
    const exists = openedFlowcharts.find((t) => t.flowchartId === info.flowchartId);
    if (!exists) {
      setOpenedFlowcharts((prev) => [
        ...prev,
        {
          flowchartId: info.flowchartId,
          projectId: info.projectId,
          projectName: info.projectName,
          flowchartName: info.flowchartName,
          projectRole: info.projectRole,
        },
      ]);
    }
    setActiveTabKey(info.flowchartId);
    /* 切换标签时关闭右侧面板并重置画布模式 */
    setSelectedExecution(null);
    setCanvasMode('view');
  }

  /** 关闭标签 */
  function handleCloseTab(targetKey: string) {
    const newTabs = openedFlowcharts.filter((t) => t.flowchartId !== targetKey);
    setOpenedFlowcharts(newTabs);
    /* 如果关闭的是当前激活标签，切换到最后一个 */
    if (activeTabKey === targetKey) {
      setActiveTabKey(newTabs.length > 0 ? newTabs[newTabs.length - 1].flowchartId : null);
      setSelectedExecution(null);
    }
  }

  /** 切换标签 */
  function handleTabChange(key: string) {
    setActiveTabKey(key);
    setSelectedExecution(null);
    setCanvasMode('view');
  }

  /** 切换画布模式 */
  function handleModeChange(mode: 'view' | 'edit') {
    setCanvasMode(mode);
    if (mode === 'edit') {
      setSelectedExecution(null);
    }
  }

  /** 点击画布节点 —— 仅当前节点参与者可打开面板 */
  function handleNodeClick(execution: NodeExecution) {
    const currentUserId = getTokenSnapshot()?.userId;
    /* 非参与者不打开面板 */
    if (!currentUserId || !execution.assignees.includes(currentUserId)) {
      return;
    }
    setSelectedExecution(execution);
  }

  /* 执行列表刷新后同步右侧面板选中状态 */
  useEffect(() => {
    if (!selectedExecution) return;
    const latest = executions.find(
      (item) => item.executionId === selectedExecution.executionId,
    );
    if (!latest) {
      setSelectedExecution(null);
      return;
    }
    if (latest !== selectedExecution) {
      setSelectedExecution(latest);
    }
  }, [executions, selectedExecution]);

  /* 选中节点对应的 nodeConfig */
  const selectedNodeConfig = selectedExecution
    ? flowDefinition?.nodesConfig.find(
        (nc) => nc.nodeId === selectedExecution.nodeId,
      )
    : undefined;

  /* 是否显示右侧面板 */
  const showRightPanel = !!selectedExecution && canvasMode !== 'edit';

  /* NEEDS_FIX 计数 */
  const needsFixCount = useMemo(
    () => executions.filter((e) => e.status === 'NEEDS_FIX').length,
    [executions],
  );

  /* 当前用户 ID */
  const currentUserId = getTokenSnapshot()?.userId;

  /* 构建标签 items */
  const tabItems = openedFlowcharts.map((tab) => ({
    key: tab.flowchartId,
    label: `${tab.projectName}/${tab.flowchartName}`,
    closable: true,
  }));

  return (
    <div className="main-workspace">
      {/* ── 左侧项目列表面板 ── */}
      <ProjectListPanel
        activeFlowchartId={activeTabKey}
        onOpenFlowchart={handleOpenFlowchart}
        collapsed={leftCollapsed}
        onToggleCollapse={() => setLeftCollapsed((prev) => !prev)}
      />

      {/* ── 中间画布区域 ── */}
      <div className="main-workspace__center">
        {/* 未登录提示 */}
        {!hasToken && (
          <Alert
            type="warning"
            showIcon
            banner
            message="当前未登录，写操作会被拦截。请先在右上角点击「登录」。"
            style={{ flexShrink: 0 }}
          />
        )}

        {/* NEEDS_FIX 警告 */}
        {needsFixCount > 0 && selectedProjectId && (
          <Alert
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            banner
            message={`有 ${needsFixCount} 个节点门禁未通过，请点击红色节点补齐文档后重试提交。`}
            style={{ flexShrink: 0 }}
          />
        )}

        {/* 多标签页 */}
        {openedFlowcharts.length > 0 && (
          <Tabs
            type="editable-card"
            hideAdd
            activeKey={activeTabKey ?? undefined}
            onChange={handleTabChange}
            onEdit={(targetKey, action) => {
              if (action === 'remove' && typeof targetKey === 'string') {
                handleCloseTab(targetKey);
              }
            }}
            items={tabItems}
            style={{ flexShrink: 0, paddingTop: 4, borderBottom: '1px solid var(--color-border)' }}
            size="small"
          />
        )}

        {/* 未打开任何标签空态 */}
        {openedFlowcharts.length === 0 ? (
          <div className="main-workspace__empty">
            <Result
              icon={<AppstoreOutlined style={{ fontSize: 64, color: 'var(--color-primary-light)', opacity: 0.6 }} />}
              title={<span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>选择一个流程图开始工作</span>}
              subTitle={
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                  从左侧面板选择项目，展开后点击流程图即可在此打开标签
                </span>
              }
            />
          </div>
        ) : flowLoading || execLoading ? (
          <div className="skeleton-container">
            <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 2, width: ['60%', '40%'] }} style={{ marginBottom: 24 }} />
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : flowError ? (
          <div className="main-workspace__empty">
            <Result
              status="404"
              title="找不到流程定义"
              subTitle={<span style={{ color: 'var(--color-text-secondary)' }}>该项目尚未配置流程，或项目不存在。后端为内存存储，重启后数据会丢失。</span>}
            />
          </div>
        ) : flowDefinition ? (
          <ErrorBoundary resetKey={selectedProjectId ?? undefined}>
            <FlowCanvas
              flowDefinition={flowDefinition}
              executions={executions}
              selectedExecutionId={selectedExecution?.executionId}
              mode={canvasMode}
              canSwitchMode={!!selectedProjectId && selectedProjectRole === 'OWNER'}
              onModeChange={handleModeChange}
              saving={saveDraftMut.isPending}
              onSaveDraft={(dto) => saveDraftMut.mutate(dto)}
              onNodeClick={handleNodeClick}
              onRefresh={handleRefresh}
            />
          </ErrorBoundary>
        ) : (
          <div className="main-workspace__empty">
            <Text type="secondary">暂无流程定义</Text>
          </div>
        )}
      </div>

      {/* ── 右侧节点详情面板 ── */}
      {showRightPanel && selectedProjectId && (
        <NodeDetailPanel
          projectId={selectedProjectId}
          execution={
            selectedExecution
              ? (executions.find(
                  (e) => e.executionId === selectedExecution.executionId,
                ) ?? selectedExecution)
              : null
          }
          nodeConfig={selectedNodeConfig}
          allExecutions={executions}
          currentUserId={currentUserId}
          onClose={() => {
            setSelectedExecution(null);
            setTimeout(() => handleRefresh(), 300);
          }}
        />
      )}
    </div>
  );
}
