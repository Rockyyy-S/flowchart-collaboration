import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import {
  DeleteOutlined,
  LinkOutlined,
  PlusOutlined,
  SaveOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type {
  ExecutionStatus,
  FlowDefinition,
  NodeExecution,
  UpdateFlowDraftDto,
} from '../../api/types';

const { Text } = Typography;

const NODE_WIDTH = 180;
const NODE_HEIGHT = 96;

interface CanvasNode {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface FlowCanvasProps {
  flowDefinition: FlowDefinition;
  executions: NodeExecution[];
  selectedExecutionId?: string;
  mode?: 'view' | 'edit';
  saving?: boolean;
  onSaveDraft?: (dto: UpdateFlowDraftDto) => void;
  onNodeClick: (execution: NodeExecution) => void;
}

const STATUS_LABEL: Record<ExecutionStatus, string> = {
  PENDING: '待启动',
  READY: '可开始',
  IN_PROGRESS: '进行中',
  GATE_CHECKING: '门禁检查中',
  COMPLETED: '已完成',
  NEEDS_FIX: '待补齐',
};

function normalizeCanvasNodes(
  nodes: FlowDefinition['graphJson']['nodes'],
): CanvasNode[] {
  return nodes.map((node, idx) => ({
    id: node.id,
    text: node.text,
    x: node.x ?? 120 + (idx % 4) * 220,
    y: node.y ?? 80 + Math.floor(idx / 4) * 150,
  }));
}

function uniqueEdges(edges: Array<{ source: string; target: string }>) {
  const keySet = new Set<string>();
  const result: Array<{ source: string; target: string }> = [];

  for (const edge of edges) {
    if (!edge.source || !edge.target || edge.source === edge.target) {
      continue;
    }

    const key = `${edge.source}->${edge.target}`;
    if (keySet.has(key)) {
      continue;
    }

    keySet.add(key);
    result.push(edge);
  }

  return result;
}

/**
 * 流程画布组件
 *
 * 视图模式：展示执行态状态并支持点击节点打开抽屉。
 * 编辑模式：支持新增节点、拖拽移动、连线、删除与保存草稿。
 */
export default function FlowCanvas({
  flowDefinition,
  executions,
  selectedExecutionId,
  mode = 'view',
  saving,
  onSaveDraft,
  onNodeClick,
}: FlowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>(() =>
    normalizeCanvasNodes(flowDefinition.graphJson.nodes ?? []),
  );
  const [edges, setEdges] = useState<Array<{ source: string; target: string }>>(
    () => uniqueEdges(flowDefinition.graphJson.edges ?? []),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectFromNodeId, setConnectFromNodeId] = useState<string | null>(
    null,
  );
  const [dragging, setDragging] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // 构建 nodeId -> execution 映射
  const execMap = useMemo(() => {
    const map = new Map<string, NodeExecution>();
    executions.forEach((e) => map.set(e.nodeId, e));
    return map;
  }, [executions]);

  useEffect(() => {
    if (isDirty) {
      return;
    }

    setNodes(normalizeCanvasNodes(flowDefinition.graphJson.nodes ?? []));
    setEdges(uniqueEdges(flowDefinition.graphJson.edges ?? []));
  }, [flowDefinition, isDirty]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const container = canvasRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const nextX = event.clientX - rect.left - dragging.offsetX;
      const nextY = event.clientY - rect.top - dragging.offsetY;

      setNodes((prev) =>
        prev.map((node) =>
          node.id === dragging.nodeId
            ? {
                ...node,
                x: Math.max(8, Math.min(nextX, rect.width - NODE_WIDTH - 8)),
                y: Math.max(8, Math.min(nextY, rect.height - NODE_HEIGHT - 8)),
              }
            : node,
        ),
      );
      setIsDirty(true);
    }

    function handleMouseUp() {
      setDragging(null);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const canEdit = mode === 'edit';

  const linkedEdges = useMemo(() => {
    const idSet = new Set(nodes.map((node) => node.id));
    return uniqueEdges(edges).filter(
      (edge) => idSet.has(edge.source) && idSet.has(edge.target),
    );
  }, [edges, nodes]);

  function handleAddNode() {
    const nextIndex = nodes.length + 1;
    const nextNode: CanvasNode = {
      id: `node-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      text: `新节点${nextIndex}`,
      x: 100 + ((nextIndex - 1) % 4) * 210,
      y: 100 + Math.floor((nextIndex - 1) / 4) * 150,
    };

    setNodes((prev) => [...prev, nextNode]);
    setSelectedNodeId(nextNode.id);
    setIsDirty(true);
  }

  function handleDeleteNode() {
    if (!selectedNodeId) {
      return;
    }

    setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
    setEdges((prev) =>
      prev.filter(
        (edge) =>
          edge.source !== selectedNodeId && edge.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId(null);
    setConnectFromNodeId(null);
    setIsDirty(true);
  }

  function handleNodeClick(nodeId: string) {
    const execution = execMap.get(nodeId);

    if (!canEdit) {
      if (execution) {
        onNodeClick(execution);
      }
      return;
    }

    if (connectFromNodeId && connectFromNodeId !== nodeId) {
      setEdges((prev) => [...prev, { source: connectFromNodeId, target: nodeId }]);
      setConnectFromNodeId(null);
      setSelectedNodeId(nodeId);
      setIsDirty(true);
      return;
    }

    setSelectedNodeId(nodeId);
  }

  function buildSavePayload(): UpdateFlowDraftDto {
    const nodeIdSet = new Set(nodes.map((node) => node.id));
    const validEdges = linkedEdges.filter(
      (edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target),
    );

    const predecessorMap = new Map<string, string[]>();
    nodes.forEach((node) => predecessorMap.set(node.id, []));

    for (const edge of validEdges) {
      const predecessors = predecessorMap.get(edge.target);
      if (!predecessors) {
        predecessorMap.set(edge.target, [edge.source]);
        continue;
      }
      if (!predecessors.includes(edge.source)) {
        predecessors.push(edge.source);
      }
    }

    const configMap = new Map(
      flowDefinition.nodesConfig.map((config) => [config.nodeId, config]),
    );

    return {
      graphJson: {
        nodes: nodes.map((node) => ({
          id: node.id,
          text: node.text,
          x: Math.round(node.x),
          y: Math.round(node.y),
        })),
        edges: validEdges,
      },
      nodesConfig: nodes.map((node) => {
        const existing = configMap.get(node.id);
        return {
          nodeId: node.id,
          name: existing?.name ?? node.text,
          requiredArtifacts: existing?.requiredArtifacts.map((item) => ({
            id: item.id,
            name: item.name,
            required: item.required,
            sourceType: item.sourceType,
          })) ?? [],
          predecessorNodeIds: predecessorMap.get(node.id) ?? [],
        };
      }),
    };
  }

  function handleSave() {
    if (!onSaveDraft) {
      return;
    }
    onSaveDraft(buildSavePayload());
    setIsDirty(false);
  }

  if (nodes.length === 0) {
    return (
      <Text type="secondary" style={{ display: 'block', padding: '24px 0' }}>
        流程尚未配置节点，请先保存流程草稿。
      </Text>
    );
  }

  return (
    <div>
      <Space size={8} wrap style={{ marginBottom: 12 }}>
        <Tag color={canEdit ? 'gold' : 'blue'}>
          {canEdit ? '编辑模式' : '执行模式'}
        </Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {canEdit
            ? '可拖拽节点、创建连线并保存草稿；编辑模式下不触发节点执行抽屉。'
            : '点击节点打开详情抽屉执行开始、提交、补齐等操作。'}
        </Text>
      </Space>

      {canEdit && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<PlusOutlined />} onClick={handleAddNode}>
            新增节点
          </Button>
          <Button
            icon={<DeleteOutlined />}
            disabled={!selectedNodeId}
            onClick={handleDeleteNode}
          >
            删除选中节点
          </Button>
          <Button
            icon={connectFromNodeId ? <StopOutlined /> : <LinkOutlined />}
            disabled={!selectedNodeId}
            onClick={() =>
              setConnectFromNodeId((prev) =>
                prev ? null : selectedNodeId,
              )
            }
          >
            {connectFromNodeId ? '取消连线' : '从选中节点发起连线'}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!isDirty}
            onClick={handleSave}
          >
            保存流程草稿
          </Button>
          {connectFromNodeId && (
            <Text type="warning" style={{ fontSize: 12 }}>
              请点击目标节点完成连线
            </Text>
          )}
        </Space>
      )}

      <div
        ref={canvasRef}
        className="real-flow-canvas"
        onClick={() => {
          if (canEdit) {
            setSelectedNodeId(null);
          }
        }}
      >
        <svg className="real-flow-canvas__edges" aria-hidden>
          <defs>
            <marker
              id="flow-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill="#8c8c8c" />
            </marker>
          </defs>
          {linkedEdges.map((edge) => {
            const source = nodes.find((item) => item.id === edge.source);
            const target = nodes.find((item) => item.id === edge.target);
            if (!source || !target) {
              return null;
            }

            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x + NODE_WIDTH / 2}
                y1={source.y + NODE_HEIGHT / 2}
                x2={target.x + NODE_WIDTH / 2}
                y2={target.y + NODE_HEIGHT / 2}
                stroke="#8c8c8c"
                strokeWidth={1.5}
                markerEnd="url(#flow-arrow)"
              />
            );
          })}
        </svg>

        <div
          className="real-flow-canvas__nodes"
        >
          {nodes.map((node) => {
            const execution = execMap.get(node.id);
            const selected = selectedNodeId === node.id;
            const highlighted = execution?.executionId === selectedExecutionId;
            const statusClass = execution
              ? `node-card-${execution.status}`
              : 'node-card-PENDING';

            return (
              <div
                key={node.id}
                className={`real-flow-node ${statusClass}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  boxShadow: selected
                    ? '0 0 0 3px rgba(22, 119, 255, 0.2)'
                    : highlighted
                    ? '0 0 0 3px rgba(250, 140, 22, 0.18)'
                    : undefined,
                  cursor: canEdit ? 'grab' : 'pointer',
                }}
                onMouseDown={(event) => {
                  if (!canEdit) {
                    return;
                  }

                  const currentTarget = event.currentTarget.getBoundingClientRect();
                  setDragging({
                    nodeId: node.id,
                    offsetX: event.clientX - currentTarget.left,
                    offsetY: event.clientY - currentTarget.top,
                  });
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleNodeClick(node.id);
                }}
                role="button"
              >
                <Text strong style={{ fontSize: 14, display: 'block' }}>
                  {node.text}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {execution ? STATUS_LABEL[execution.status] : '未生成执行实例'}
                </Text>
                {canEdit && selected && (
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 6 }}>
                    ID: {node.id}
                  </Text>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
