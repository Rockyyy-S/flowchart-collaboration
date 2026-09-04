import { Badge, Button, Card, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ExecutionStatus, NodeExecution, NodeConfig } from '../../api/types';

const { Text } = Typography;

/** 优先级色点颜色映射 */
const PRIORITY_DOT_COLOR: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#3b82f6',
  HIGH: '#f97316',
  URGENT: '#ef4444',
};

/** 状态对应的显示配置 —— 升级配色 */
const STATUS_CONFIG: Record<
  ExecutionStatus,
  { label: string; color: string; icon: React.ReactNode; bgGradient: string }
> = {
  PENDING: {
    label: '待启动',
    color: '#94a3b8',
    icon: <ClockCircleOutlined />,
    bgGradient: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
  },
  READY: {
    label: '可开始',
    color: '#4f46e5',
    icon: <PlayCircleOutlined />,
    bgGradient: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
  },
  IN_PROGRESS: {
    label: '进行中',
    color: '#f59e0b',
    icon: <SyncOutlined spin />,
    bgGradient: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
  },
  GATE_CHECKING: {
    label: '门禁检查中',
    color: '#8b5cf6',
    icon: <LoadingOutlined />,
    bgGradient: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
  },
  COMPLETED: {
    label: '已完成',
    color: '#10b981',
    icon: <CheckCircleOutlined />,
    bgGradient: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
  },
  NEEDS_FIX: {
    label: '待补齐',
    color: '#ef4444',
    icon: <ExclamationCircleOutlined />,
    bgGradient: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
  },
  REJECTED: {
    label: '被回退',
    color: '#dc2626',
    icon: <CloseCircleOutlined />,
    bgGradient: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
  },
};

interface NodeCardProps {
  execution: NodeExecution;
  nodeConfig?: NodeConfig;
  /** 是否高亮（选中或待补齐） */
  highlighted?: boolean;
  onClick: () => void;
}

/**
 * 单个节点卡片
 *
 * 职责：展示节点名称、状态，并提供快捷动作入口。
 * 详细操作（开始/提交/绑定）收进 NodeDetailDrawer。
 */
export default function NodeCard({
  execution,
  nodeConfig,
  highlighted,
  onClick,
}: NodeCardProps) {
  const cfg = STATUS_CONFIG[execution.status];
  const requiredCount = nodeConfig?.requiredArtifacts.filter((a) => a.required).length ?? 0;

  return (
    <Tooltip
      title={
        execution.status === 'NEEDS_FIX'
          ? '门禁未通过，请点击补齐缺失文档'
          : execution.status === 'PENDING'
          ? '前置节点完成后自动解锁'
          : '点击查看详情'
      }
      placement="bottom"
    >
      <Card
        hoverable={execution.status !== 'PENDING'}
        className={`flow-node-card node-card-${execution.status}`}
        style={{
          width: 168,
          minWidth: 168,
          cursor: execution.status === 'PENDING' ? 'not-allowed' : 'pointer',
          borderWidth: 2,
          borderRadius: 'var(--radius-md)',
          transition: 'all var(--transition-normal)',
          boxShadow: highlighted ? `0 0 0 3px ${cfg.color}22, var(--shadow-md)` : 'var(--shadow-sm)',
          background: cfg.bgGradient,
        }}
        styles={{ body: { padding: '12px 14px' } }}
        onClick={() => {
          if (execution.status !== 'PENDING') onClick();
        }}
      >
        {/* 状态角标 + 优先级色点 */}
        <div className="flex justify-between items-center mb-2">
          {/* 优先级色点（左上角） */}
          {nodeConfig?.priority && (
            <span
              title={`优先级: ${nodeConfig.priority}`}
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: PRIORITY_DOT_COLOR[nodeConfig.priority] ?? '#94a3b8',
                marginRight: 6,
                flexShrink: 0,
              }}
            />
          )}
          <Badge
            color={cfg.color}
            text={
              <Text style={{ fontSize: 11, color: cfg.color }}>
                {cfg.icon} {cfg.label}
              </Text>
            }
          />
        </div>

        {/* 节点名称 */}
        <Text
          strong
          style={{ fontSize: 14, display: 'block', marginBottom: 8 }}
        >
          {execution.nodeName}
        </Text>

        {/* 必需输出物数量提示 */}
        {requiredCount > 0 && (
          <div className="flex items-center gap-1">
            <Tag
              color={
                execution.status === 'COMPLETED'
                  ? 'success'
                  : execution.status === 'NEEDS_FIX'
                  ? 'error'
                  : 'default'
              }
              style={{ fontSize: 11, margin: 0, borderRadius: 6 }}
            >
              需要 {requiredCount} 份文档
            </Tag>
          </div>
        )}

        {/* 执行人摘要（显示首个执行人 + 剩余数量） */}
        {nodeConfig?.assignees && nodeConfig.assignees.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              👤 {nodeConfig.assignees[0]}
              {nodeConfig.assignees.length > 1 && ` +${nodeConfig.assignees.length - 1}`}
            </Text>
          </div>
        )}

        {/* 截止日期（底部小字） */}
        {nodeConfig?.dueDate && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>
              ⏰ 截止 {dayjs(nodeConfig.dueDate).format('MM-DD')}
            </Text>
          </div>
        )}

        {/* READY 状态快捷按钮 */}
        {execution.status === 'READY' && (
          <Button
            size="small"
            type="primary"
            style={{
              marginTop: 8,
              width: '100%',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              fontWeight: 500,
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            开始执行
          </Button>
        )}
        {execution.status === 'NEEDS_FIX' && (
          <Button
            size="small"
            danger
            style={{
              marginTop: 8,
              width: '100%',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              fontWeight: 500,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            补齐文档
          </Button>
        )}
      </Card>
    </Tooltip>
  );
}
