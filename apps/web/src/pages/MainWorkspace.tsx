import { useEffect, useMemo, useState } from 'react';
import { Alert, Result, Segmented, Skeleton, Space, Typography, message } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getExecutions } from '../api/executions';
import { getCurrentFlow, updateFlowDraft } from '../api/flows';
import { getAccessToken, subscribeTokenChange } from '../auth/token';
import FlowCanvas from '../components/FlowCanvas';
import NodeDetailPanel from '../components/NodeDetailPanel';
import ProjectListPanel from '../components/ProjectListPanel';
import type { NodeExecution, UpdateFlowDraftDto } from '../api/types';

const { Text } = Typography;

/**
 * 主工作区页面 —— 三栏布局
 *
 * 左侧：项目列表面板（240px，可折叠）
 * 中间：全屏画布（铺满剩余空间）
 * 右侧：节点详情面板（360px，仅选中节点时显示）
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

  /* ── 当前选中项目 ── */
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectRole, setSelectedProjectRole] = useState<'OWNER' | 'MEMBER' | 'VIEWER'>('OWNER');

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

  /** 选中项目 */
  function handleSelectProject(projectId: string, role: 'OWNER' | 'MEMBER' | 'VIEWER') {
    setSelectedProjectId(projectId);
    setSelectedProjectRole(role);
    /* 切换项目时关闭右侧面板并重置模式 */
    setSelectedExecution(null);
    setCanvasMode('view');
  }

  /** 点击画布节点 */
  function handleNodeClick(execution: NodeExecution) {
    setSelectedExecution(execution);
  }

  /** 切换画布模式 */
  function handleModeChange(value: string | number) {
    const mode = value === 'edit' ? 'edit' : 'view';
    setCanvasMode(mode);
    if (mode === 'edit') {
      setSelectedExecution(null);
    }
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

  return (
    <div className="main-workspace">
      {/* ── 左侧项目列表面板 ── */}
      <ProjectListPanel
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
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
            message="当前未登录，写操作会被拦截。请先在右上角点击「获取开发令牌」。"
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

        {/* 未选择项目空态 */}
        {!selectedProjectId ? (
          <div className="main-workspace__empty">
            <Result
              icon={<img src="" alt="" style={{ display: 'none' }} />}
              title="请从左侧选择一个项目"
              subTitle="或点击「新建」/「快速体验」创建项目"
            />
          </div>
        ) : flowLoading || execLoading ? (
          <div style={{ padding: 24 }}>
            <Skeleton active paragraph={{ rows: 5 }} />
          </div>
        ) : flowError ? (
          <div className="main-workspace__empty">
            <Result
              status="404"
              title="找不到流程定义"
              subTitle="该项目尚未配置流程，或项目不存在。后端为内存存储，重启后数据会丢失。"
            />
          </div>
        ) : flowDefinition ? (
          <>
            {/* 模式切换工具栏（悬浮在画布上方） */}
            <div className="main-workspace__mode-bar">
              <Space size={10}>
                {/* 仅 OWNER 可切换编辑模式 */}
                {selectedProjectRole === 'OWNER' && (
                  <Segmented
                    size="small"
                    value={canvasMode}
                    options={[
                      { label: '执行模式', value: 'view' },
                      { label: '编辑模式', value: 'edit' },
                    ]}
                    onChange={handleModeChange}
                  />
                )}
                <Text
                  type="link"
                  style={{ fontSize: 12, cursor: 'pointer' }}
                  onClick={handleRefresh}
                >
                  <ReloadOutlined /> 刷新
                </Text>
              </Space>
            </div>
            <FlowCanvas
              flowDefinition={flowDefinition}
              executions={executions}
              selectedExecutionId={selectedExecution?.executionId}
              mode={canvasMode}
              saving={saveDraftMut.isPending}
              onSaveDraft={(dto) => saveDraftMut.mutate(dto)}
              onNodeClick={handleNodeClick}
            />
          </>
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
          onClose={() => {
            setSelectedExecution(null);
            setTimeout(() => handleRefresh(), 300);
          }}
        />
      )}
    </div>
  );
}
