/**
 * 主工作区页面（重构版）—— 三栏布局 + 多标签流程图
 *
 * 左侧：项目列表面板（240px，可折叠）——点击项目展开流程图列表，点击流程图打开标签
 * 中间：画布区域 —— 顶部多标签 + 下方 FlowCanvas（按当前激活标签的 projectId 加载数据）
 * 右侧：节点详情面板（360px，点击节点时显示）
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Input, List, Result, Skeleton, Space, Tabs, Tag, Typography, message } from 'antd';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FolderOutlined,
  NodeIndexOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getExecutions } from '../api/executions';
import { getCurrentFlow, updateFlowDraft } from '../api/flows';
import { getAccessToken, getTokenSnapshot, subscribeTokenChange } from '../auth/token';
import ErrorBoundary from '../components/ErrorBoundary';
import FlowCanvas from '../components/FlowCanvas';
import NodeDetailPanel from '../components/NodeDetailPanel';
import ProjectListPanel from '../components/ProjectListPanel';
import TeamManagement from '../components/TeamManagement';
import { OPEN_WORKSPACE_SEARCH_EVENT, type WorkspaceSearchDetail } from '../constants/workspaceEvents';
import type { OpenFlowchartInfo } from '../components/ProjectListPanel';
import type { NodeExecution, UpdateFlowDraftDto } from '../api/types';

const { Text } = Typography;
const SEARCH_SUGGESTIONS = ['需求评审', '技术方案', '测试验收', '主流程图'];

type ActivityKey = 'projects' | 'search' | 'teams' | 'notifications';

interface WorkspaceNotification {
  id: string;
  unread: boolean;
  title: string;
  desc: string;
}

interface SearchResultItem {
  id: string;
  type: 'flow' | 'node';
  title: string;
  description: string;
  flowchartInfo?: OpenedFlowchart;
  execution?: NodeExecution;
}

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
  const searchInputRef = useRef<any>(null);

  /* ── 令牌状态 ── */
  const [hasToken, setHasToken] = useState(() => !!getAccessToken());
  useEffect(() => {
    return subscribeTokenChange(() => setHasToken(!!getAccessToken()));
  }, []);

  /* ── 响应式布局状态（桌面/平板） ── */
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isDesktop = viewportWidth >= 1280;
  const isTablet = viewportWidth >= 1024 && viewportWidth < 1280;

  /* ── Activity Bar 与 Side Panel 状态 ── */
  const [activeActivity, setActiveActivity] = useState<ActivityKey>('projects');
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const deferredSearchKeyword = useDeferredValue(searchKeyword);

  useEffect(() => {
    if (isTablet) {
      setSidePanelOpen(false);
      return;
    }
    if (isDesktop) {
      setSidePanelOpen(true);
    }
  }, [isDesktop, isTablet]);

  useEffect(() => {
    function handleWorkspaceSearch(event: Event) {
      const detail = (event as CustomEvent<WorkspaceSearchDetail>).detail;
      setActiveActivity('search');
      setSidePanelOpen(true);
      if (typeof detail?.query === 'string') {
        setSearchKeyword(detail.query);
      }
      window.setTimeout(() => {
        searchInputRef.current?.focus?.();
      }, 0);
    }

    window.addEventListener(OPEN_WORKSPACE_SEARCH_EVENT, handleWorkspaceSearch as EventListener);
    return () => {
      window.removeEventListener(OPEN_WORKSPACE_SEARCH_EVENT, handleWorkspaceSearch as EventListener);
    };
  }, []);

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
    if (isTablet) {
      setSidePanelOpen(false);
    }
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

  /** 点击画布节点 —— 打开右侧节点详情面板，具体操作权限由详情面板内部控制 */
  function handleNodeClick(execution: NodeExecution) {
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
    label: (
      <span className="workspace-tab-label">
        <span className="workspace-tab-label__primary">{tab.flowchartName}</span>
        <span className="workspace-tab-label__secondary">{tab.projectName}</span>
      </span>
    ),
    closable: true,
  }));

  /* 搜索结果（MVP：本地检索） */
  const searchResults = useMemo<SearchResultItem[]>(() => {
    const key = deferredSearchKeyword.trim().toLowerCase();
    if (!key) return [];
    const flowMatches = openedFlowcharts
      .filter((item) => `${item.projectName} ${item.flowchartName}`.toLowerCase().includes(key))
      .map((item) => ({
        type: 'flow' as const,
        id: item.flowchartId,
        title: item.flowchartName,
        description: item.projectName,
        flowchartInfo: item,
      }));
    const nodeMatches = executions
      .filter((item) => `${item.nodeName} ${item.nodeId}`.toLowerCase().includes(key))
      .map((item) => ({
        type: 'node' as const,
        id: item.executionId,
        title: item.nodeName,
        description: `节点状态：${item.status}`,
        execution: item,
      }));
    return [...flowMatches, ...nodeMatches].slice(0, 30);
  }, [deferredSearchKeyword, openedFlowcharts, executions]);

  /* 通知列表（MVP：由执行状态派生） */
  const notifications = useMemo<WorkspaceNotification[]>(() => {
    const list: WorkspaceNotification[] = [];
    executions.forEach((item) => {
      if (item.status === 'REJECTED') {
        list.push({
          id: `${item.executionId}-r`,
          unread: true,
          title: `${item.nodeName} 被回退`,
          desc: item.rejectionReason ? `原因：${item.rejectionReason}` : '请补齐后重新提交',
        });
      }
      if (item.status === 'READY') {
        list.push({
          id: `${item.executionId}-ready`,
          unread: false,
          title: `${item.nodeName} 可开始`,
          desc: '前置节点已完成，等待参与者执行',
        });
      }
    });
    return list.slice(0, 20);
  }, [executions]);
  const unreadNotificationCount = notifications.filter((item) => item.unread).length;

  function handleSwitchActivity(next: ActivityKey) {
    if (activeActivity === next) {
      setSidePanelOpen((prev) => !prev);
      return;
    }
    setActiveActivity(next);
    setSidePanelOpen(true);
  }

  function handleSearchResultClick(item: SearchResultItem) {
    if (item.type === 'flow' && item.flowchartInfo) {
      handleOpenFlowchart({
        projectId: item.flowchartInfo.projectId,
        projectName: item.flowchartInfo.projectName,
        projectRole: item.flowchartInfo.projectRole,
        flowchartId: item.flowchartInfo.flowchartId,
        flowchartName: item.flowchartInfo.flowchartName,
      });
      return;
    }

    if (item.execution) {
      handleNodeClick(item.execution);
    }
  }

  const statusSummary = useMemo(() => {
    const total = executions.length;
    return {
      total,
      completed: executions.filter((e) => e.status === 'COMPLETED').length,
      inProgress: executions.filter((e) => e.status === 'IN_PROGRESS').length,
      ready: executions.filter((e) => e.status === 'READY').length,
      attention: executions.filter((e) => e.status === 'NEEDS_FIX' || e.status === 'REJECTED').length,
    };
  }, [activeTab, executions]);

  return (
    <div className="workspace-shell">
      <aside className="workspace-left-rail">
        <div className="activity-bar">
          <div className="activity-bar__brand" aria-hidden>
            F
          </div>
          <button
            type="button"
            className={`activity-bar__item ${activeActivity === 'projects' && sidePanelOpen ? 'is-active' : ''}`}
            onClick={() => handleSwitchActivity('projects')}
            title="项目与流程图"
          >
            <FolderOutlined />
            <span className="activity-bar__item-label">项目</span>
          </button>
          <button
            type="button"
            className={`activity-bar__item ${activeActivity === 'teams' && sidePanelOpen ? 'is-active' : ''}`}
            onClick={() => handleSwitchActivity('teams')}
            title="团队"
          >
            <TeamOutlined />
            <span className="activity-bar__item-label">团队</span>
          </button>
          <button
            type="button"
            className={`activity-bar__item ${activeActivity === 'notifications' && sidePanelOpen ? 'is-active' : ''}`}
            onClick={() => handleSwitchActivity('notifications')}
            title="执行状态（被回退 / 待处理节点）"
          >
            <ClockCircleOutlined />
            <span className="activity-bar__item-label">待办</span>
            {unreadNotificationCount > 0 && <span className="activity-bar__badge">{Math.min(unreadNotificationCount, 9)}</span>}
          </button>
          <div className="activity-bar__footer">
            <span className="activity-bar__footer-value">{openedFlowcharts.length}</span>
            <span className="activity-bar__footer-label">标签</span>
          </div>
        </div>

        <div className={`workspace-side-panel ${sidePanelOpen ? 'is-open' : ''}`}>
          {activeActivity === 'projects' && (
            <ProjectListPanel
              activeFlowchartId={activeTabKey}
              onOpenFlowchart={handleOpenFlowchart}
              collapsed={false}
              onToggleCollapse={() => setSidePanelOpen(false)}
            />
          )}

          {activeActivity === 'search' && (
            <div className="workspace-side-panel__inner">
              <div className="workspace-side-panel__header">
                <div>
                  <div className="workspace-side-panel__title">快速搜索</div>
                  <div className="workspace-side-panel__subtitle">在已打开流程图和当前节点中快速定位</div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => setSidePanelOpen(false)}
                />
              </div>
              <Input
                ref={searchInputRef}
                allowClear
                placeholder="搜索节点名、流程图名"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
              />
              {!deferredSearchKeyword.trim() ? (
                <div className="workspace-search-empty">
                  <Text className="workspace-search-empty__title">试试这些关键词</Text>
                  <div className="workspace-search-empty__suggestions">
                    {SEARCH_SUGGESTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="workspace-search-suggestion"
                        onClick={() => setSearchKeyword(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <Text className="workspace-search-empty__hint">
                    也可以在顶部按 <strong>Ctrl/Cmd + K</strong> 直接拉起搜索。
                  </Text>
                </div>
              ) : searchResults.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="没有匹配结果，试试项目名、流程图名或节点名称"
                  style={{ paddingBlock: 32 }}
                />
              ) : (
                <List
                  size="small"
                  dataSource={searchResults}
                  style={{ marginTop: 12 }}
                  renderItem={(item) => (
                    <List.Item className="workspace-search-result" onClick={() => handleSearchResultClick(item)}>
                      <div className="workspace-search-result__icon">
                        {item.type === 'flow' ? <FileTextOutlined /> : <NodeIndexOutlined />}
                      </div>
                      <div className="workspace-search-result__content">
                        <div className="workspace-search-result__title-row">
                          <Text className="workspace-search-result__title">{item.title}</Text>
                          <Tag color={item.type === 'flow' ? 'blue' : 'processing'}>
                            {item.type === 'flow' ? '流程图' : '节点'}
                          </Tag>
                        </div>
                        <Text className="workspace-search-result__desc">{item.description}</Text>
                      </div>
                      <ArrowRightOutlined className="workspace-search-result__arrow" />
                    </List.Item>
                  )}
                />
              )}
            </div>
          )}

          {activeActivity === 'teams' && <TeamManagement embedded />}

          {activeActivity === 'notifications' && (
            <div className="workspace-side-panel__inner">
              <div className="workspace-side-panel__header">
                <div>
                  <div className="workspace-side-panel__title">通知</div>
                  <div className="workspace-side-panel__subtitle">需要你处理或留意的流程动态</div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => setSidePanelOpen(false)}
                />
              </div>
              <List
                size="small"
                dataSource={notifications}
                locale={{ emptyText: '暂无通知' }}
                renderItem={(item) => (
                  <List.Item className="workspace-notification-item">
                    <Space align="start" size={8}>
                      <span className={`workspace-notice-dot ${item.unread ? 'is-unread' : ''}`} />
                      <div>
                        <Text style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</Text>
                        <br />
                        <Text style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.desc}</Text>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          )}
        </div>

        {isTablet && sidePanelOpen && (
          <div className="workspace-side-panel-mask" onClick={() => setSidePanelOpen(false)} />
        )}
      </aside>

      <main className="main-workspace__center">
        {!hasToken && (
          <Alert
            type="warning"
            showIcon
            banner
            message="当前未登录，写操作会被拦截。请先在右上角点击「登录」。"
            style={{ flexShrink: 0 }}
          />
        )}

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

        {openedFlowcharts.length === 0 ? (
          <div className="main-workspace__empty">
            <Result
              icon={<AppstoreOutlined style={{ fontSize: 64, color: 'var(--color-primary-light)', opacity: 0.6 }} />}
              title={<span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>从这里开始你的第一个项目</span>}
              subTitle={
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                  左侧点击项目和流程图，或者先在「项目」面板里新建
                </span>
              }
              extra={[
                <Button key="open-projects" type="primary" onClick={() => handleSwitchActivity('projects')}>
                  打开项目面板
                </Button>,
                <Button key="open-teams" onClick={() => handleSwitchActivity('teams')}>
                  先创建团队
                </Button>,
              ]}
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

        <footer className="workspace-status-bar">
          <div className="workspace-status-bar__summary">
            {activeTab ? `${activeTab.projectName} / ${activeTab.flowchartName}` : '未打开流程图'}
          </div>
          <div className="workspace-status-bar__metrics">
            <span className="workspace-status-pill">节点 {statusSummary.total}</span>
            <span className="workspace-status-pill is-active">进行中 {statusSummary.inProgress}</span>
            <span className="workspace-status-pill is-success">已完成 {statusSummary.completed}</span>
            <span className="workspace-status-pill is-ready">可开始 {statusSummary.ready}</span>
            <span className="workspace-status-pill is-alert">待处理 {statusSummary.attention}</span>
          </div>
        </footer>
      </main>

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
