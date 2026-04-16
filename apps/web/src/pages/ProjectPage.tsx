import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Result,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getExecutions } from '../api/executions';
import { getCurrentFlow } from '../api/flows';
import FlowCanvas from '../components/FlowCanvas';
import NodeDetailDrawer from '../components/NodeDetailDrawer';
import type { NodeExecution } from '../api/types';

const { Title, Text } = Typography;

/**
 * 项目详情页
 *
 * 布局：
 * - 顶部：面包屑 + 项目基本信息 + 执行进度统计
 * - 中部：流程画布（节点状态可视化）
 * - 右侧：节点详情抽屉（单击节点后打开）
 */
export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [selectedExecution, setSelectedExecution] =
    useState<NodeExecution | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 拉取流程定义
  const {
    data: flowDefinition,
    isLoading: flowLoading,
    isError: flowError,
  } = useQuery({
    queryKey: ['flow', projectId],
    queryFn: () => getCurrentFlow(projectId!),
    enabled: !!projectId,
    staleTime: 30000,
  });

  // 拉取执行列表（轮询：GATE_CHECKING 时短轮询）
  const {
    data: executions = [],
    isLoading: execLoading,
  } = useQuery({
    queryKey: ['executions', projectId],
    queryFn: () => getExecutions(projectId!),
    enabled: !!projectId,
    // 若有节点在 GATE_CHECKING，每 2 秒刷新一次
    refetchInterval: (query) => {
      const data = query.state.data as NodeExecution[] | undefined;
      const hasChecking = data?.some((e) => e.status === 'GATE_CHECKING');
      return hasChecking ? 2000 : false;
    },
  });

  /** 刷新全部数据 */
  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['executions', projectId] });
    queryClient.invalidateQueries({ queryKey: ['flow', projectId] });
  }

  /** 打开节点抽屉 */
  function handleNodeClick(execution: NodeExecution) {
    setSelectedExecution(execution);
    setDrawerOpen(true);
  }

  useEffect(() => {
    if (!selectedExecution) {
      return;
    }

    const latest = executions.find(
      (item) => item.executionId === selectedExecution.executionId,
    );

    if (!latest) {
      setDrawerOpen(false);
      setSelectedExecution(null);
      return;
    }

    if (latest !== selectedExecution) {
      setSelectedExecution(latest);
    }
  }, [executions, selectedExecution]);

  // ─── 统计数据 ───
  const summary = useMemo(() => {
    let completed = 0;
    let needsFix = 0;
    let inProgress = 0;

    executions.forEach((item) => {
      if (item.status === 'COMPLETED') {
        completed += 1;
      }
      if (item.status === 'NEEDS_FIX') {
        needsFix += 1;
      }
      if (item.status === 'IN_PROGRESS' || item.status === 'GATE_CHECKING') {
        inProgress += 1;
      }
    });

    return {
      total: executions.length,
      completed,
      needsFix,
      inProgress,
    };
  }, [executions]);

  const { total, completed, needsFix, inProgress } = summary;

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ─── 选中节点对应的 nodeConfig ───
  const selectedNodeConfig = selectedExecution
    ? flowDefinition?.nodesConfig.find(
        (nc) => nc.nodeId === selectedExecution.nodeId,
      )
    : undefined;

  if (flowError) {
    return (
      <Result
        status="404"
        title="找不到流程定义"
        subTitle="该项目尚未配置流程，或项目不存在。后端为内存存储，重启后数据会丢失。"
        extra={
          <Link to="/">
            <Button icon={<ArrowLeftOutlined />}>返回工作台</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      {/* 面包屑导航 */}
      <Breadcrumb
        items={[
          { title: <Link to="/">工作台</Link> },
          { title: '项目详情' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* ─── 顶部信息卡 ─── */}
      <Card style={{ marginBottom: 20, borderRadius: 10 }}>
        {flowLoading || execLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <div className="flex flex-wrap justify-between items-start gap-4">
            {/* 左：标题 */}
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {flowDefinition?.projectId
                  ? `项目 ${projectId?.slice(0, 8)}…`
                  : '项目工作台'}
              </Title>
              <Space size={4} style={{ marginTop: 4, flexWrap: 'wrap' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  项目 ID: {projectId}
                </Text>
                <Tag color="blue">活跃</Tag>
                {needsFix > 0 && (
                  <Tag
                    color="error"
                    icon={<ExclamationCircleOutlined />}
                  >
                    {needsFix} 个节点待补齐
                  </Tag>
                )}
              </Space>
            </div>

            {/* 右：进度统计 */}
            <Row gutter={[16, 8]}>
              <Col>
                <Statistic
                  title="总节点"
                  value={total}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col>
                <Statistic
                  title="已完成"
                  value={completed}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ fontSize: 20, color: '#52c41a' }}
                />
              </Col>
              <Col>
                <Statistic
                  title="进行中"
                  value={inProgress}
                  prefix={<SyncOutlined spin={inProgress > 0} />}
                  valueStyle={{ fontSize: 20, color: '#fa8c16' }}
                />
              </Col>
              <Col>
                <Statistic
                  title="完成率"
                  value={progress}
                  suffix="%"
                  valueStyle={{
                    fontSize: 20,
                    color: progress === 100 ? '#52c41a' : '#1677ff',
                  }}
                />
              </Col>
              <Col>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  style={{ marginTop: 24 }}
                >
                  刷新
                </Button>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {/* ─── NEEDS_FIX 警告横幅 ─── */}
      {needsFix > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={`有 ${needsFix} 个节点门禁未通过，请点击红色节点卡片补齐文档后重试提交。`}
          style={{ marginBottom: 16, borderRadius: 8 }}
          action={
            <Button
              size="small"
              danger
              onClick={() => {
                const first = executions.find((e) => e.status === 'NEEDS_FIX');
                if (first) handleNodeClick(first);
              }}
            >
              查看第一个缺失节点
            </Button>
          }
        />
      )}

      {/* ─── 流程画布 ─── */}
      <Card
        title="流程画布"
        style={{ borderRadius: 10, marginBottom: 16 }}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            点击节点卡片进入操作
          </Text>
        }
      >
        {flowLoading || execLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : flowDefinition ? (
          <FlowCanvas
            flowDefinition={flowDefinition}
            executions={executions}
            selectedExecutionId={selectedExecution?.executionId}
            onNodeClick={handleNodeClick}
          />
        ) : (
          <Text type="secondary">暂无流程定义</Text>
        )}
      </Card>

      {/* ─── 节点详情抽屉 ─── */}
      <NodeDetailDrawer
        projectId={projectId!}
        execution={
          // 每次刷新 executions 后同步最新状态到抽屉
          selectedExecution
            ? (executions.find(
                (e) => e.executionId === selectedExecution.executionId,
              ) ?? selectedExecution)
            : null
        }
        nodeConfig={selectedNodeConfig}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          // 关闭时刷新以获取最新 PENDING→READY 解锁状态
          setTimeout(() => handleRefresh(), 300);
        }}
      />
    </div>
  );
}
