import { Badge, Button, Card, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ExecutionStatus, NodeExecution, NodeConfig } from '../../api/types';

const { Text } = Typography;

/** 状态对应的显示配置 */
const STATUS_CONFIG: Record<
  ExecutionStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: '待启动',
    color: '#8c8c8c',
    icon: <ClockCircleOutlined />,
  },
  READY: {
    label: '可开始',
    color: '#1677ff',
    icon: <PlayCircleOutlined />,
  },
  IN_PROGRESS: {
    label: '进行中',
    color: '#fa8c16',
    icon: <SyncOutlined spin />,
  },
  GATE_CHECKING: {
    label: '门禁检查中',
    color: '#722ed1',
    icon: <LoadingOutlined />,
  },
  COMPLETED: {
    label: '已完成',
    color: '#52c41a',
    icon: <CheckCircleOutlined />,
  },
  NEEDS_FIX: {
    label: '待补齐',
    color: '#ff4d4f',
    icon: <ExclamationCircleOutlined />,
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
        className={`node-card-${execution.status}`}
        style={{
          width: 160,
          minWidth: 160,
          cursor: execution.status === 'PENDING' ? 'not-allowed' : 'pointer',
          borderWidth: 2,
          borderRadius: 10,
          transition: 'all 0.2s',
          boxShadow: highlighted ? `0 0 0 3px ${cfg.color}33` : undefined,
        }}
        bodyStyle={{ padding: '12px 14px' }}
        onClick={() => {
          if (execution.status !== 'PENDING') onClick();
        }}
      >
        {/* 状态角标 */}
        <div className="flex justify-between items-center mb-2">
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
              style={{ fontSize: 11, margin: 0 }}
            >
              需要 {requiredCount} 份文档
            </Tag>
          </div>
        )}

        {/* READY 状态快捷按钮提示 */}
        {execution.status === 'READY' && (
          <Button
            size="small"
            type="primary"
            style={{ marginTop: 8, width: '100%', fontSize: 12 }}
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
            style={{ marginTop: 8, width: '100%', fontSize: 12 }}
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
