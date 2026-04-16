import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  LinkOutlined,
  MinusCircleOutlined,
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

/** 节点卡片常量 */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 96;

/** 画布内部节点模型 */
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

/** 执行状态中文映射 */
const STATUS_LABEL: Record<ExecutionStatus, string> = {
  PENDING: '待启动',
  READY: '可开始',
  IN_PROGRESS: '进行中',
  GATE_CHECKING: '门禁检查中',
  COMPLETED: '已完成',
  NEEDS_FIX: '待补齐',
};

/** 规范化节点位置，确保每个节点都有 x/y */
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

/** 去重边 */
function uniqueEdges(edges: Array<{ source: string; target: string }>) {
  const keySet = new Set<string>();
  const result: Array<{ source: string; target: string }> = [];
  for (const edge of edges) {
    if (!edge.source || !edge.target || edge.source === edge.target) continue;
    const key = `${edge.source}->${edge.target}`;
    if (keySet.has(key)) continue;
    keySet.add(key);
    result.push(edge);
  }
  return result;
}

/** 新增节点表单字段 */
interface AddNodeFormValues {
  name: string;
  description?: string;
  artifacts: Array<{ name: string; required: boolean }>;
}

/**
 * 全屏流程画布组件
 *
 * 支持：
 * - 画布拖动平移（Pan）：在空白区域按住鼠标拖动
 * - 节点拖拽：编辑模式下拖拽节点移动位置
 * - 双击空白区域新增节点（编辑模式）
 * - 连线、删除、保存草稿（编辑模式）
 * - 点击节点查看详情（执行模式）
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

  /* ── 节点和边数据 ── */
  const [nodes, setNodes] = useState<CanvasNode[]>(() =>
    normalizeCanvasNodes(flowDefinition.graphJson.nodes ?? []),
  );
  const [edges, setEdges] = useState<Array<{ source: string; target: string }>>(
    () => uniqueEdges(flowDefinition.graphJson.edges ?? []),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectFromNodeId, setConnectFromNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  /* ── 画布平移状态 ── */
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panningRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  /* ── 节点拖拽状态 ── */
  const draggingRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  /* ── 新增节点弹窗 ── */
  const [addNodeModalOpen, setAddNodeModalOpen] = useState(false);
  const [addNodePosition, setAddNodePosition] = useState({ x: 0, y: 0 });
  const [addNodeForm] = Form.useForm<AddNodeFormValues>();

  /* nodeId -> execution 映射 */
  const execMap = useMemo(() => {
    const map = new Map<string, NodeExecution>();
    executions.forEach((e) => map.set(e.nodeId, e));
    return map;
  }, [executions]);

  /* 当外部数据变化且画布未被编辑时，同步数据 */
  useEffect(() => {
    if (isDirty) return;
    setNodes(normalizeCanvasNodes(flowDefinition.graphJson.nodes ?? []));
    setEdges(uniqueEdges(flowDefinition.graphJson.edges ?? []));
  }, [flowDefinition, isDirty]);

  const canEdit = mode === 'edit';

  /* 有效边（两端节点都存在） */
  const linkedEdges = useMemo(() => {
    const idSet = new Set(nodes.map((n) => n.id));
    return uniqueEdges(edges).filter(
      (e) => idSet.has(e.source) && idSet.has(e.target),
    );
  }, [edges, nodes]);

  /* ═══════════════════════════════════
   * 画布拖动（Pan）和节点拖拽的统一鼠标事件
   * ═══════════════════════════════════ */

  /** 节点 mousedown —— 编辑模式下开始拖拽节点 */
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (!canEdit) return;
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      draggingRef.current = {
        nodeId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
    },
    [canEdit],
  );

  /** 画布空白区域 mousedown —— 开始平移 */
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      panningRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panOffset.x,
        startPanY: panOffset.y,
      };
    },
    [panOffset],
  );

  /* 用 ref 持有最新 panOffset 避免 effect 依赖频繁变化 */
  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      /* 优先处理节点拖拽 */
      if (draggingRef.current) {
        const container = canvasRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const currentPan = panOffsetRef.current;
        const logicX =
          e.clientX - rect.left - currentPan.x - draggingRef.current.offsetX;
        const logicY =
          e.clientY - rect.top - currentPan.y - draggingRef.current.offsetY;
        setNodes((prev) =>
          prev.map((node) =>
            node.id === draggingRef.current!.nodeId
              ? { ...node, x: Math.max(0, logicX), y: Math.max(0, logicY) }
              : node,
          ),
        );
        setIsDirty(true);
        return;
      }

      /* 画布平移 */
      if (panningRef.current) {
        const dx = e.clientX - panningRef.current.startX;
        const dy = e.clientY - panningRef.current.startY;
        setPanOffset({
          x: panningRef.current.startPanX + dx,
          y: panningRef.current.startPanY + dy,
        });
        setIsPanning(true);
      }
    }

    function handleMouseUp() {
      draggingRef.current = null;
      panningRef.current = null;
      setIsPanning(false);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  /* ═══════════════════════════
   * 双击画布空白区域新增节点
   * ═══════════════════════════ */
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit) return;
      const container = canvasRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const logicX = e.clientX - rect.left - panOffsetRef.current.x;
      const logicY = e.clientY - rect.top - panOffsetRef.current.y;
      setAddNodePosition({ x: logicX, y: logicY });
      setAddNodeModalOpen(true);
    },
    [canEdit],
  );

  /* 暂存新增节点的配置信息（随下次保存一并提交） */
  const pendingNodeConfigsRef = useRef<
    Map<
      string,
      {
        name: string;
        description?: string;
        artifacts: Array<{ id: string; name: string; required: boolean }>;
      }
    >
  >(new Map());

  /** 确认新增节点 */
  async function handleAddNodeConfirm() {
    try {
      const values = await addNodeForm.validateFields();
      const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const newNode: CanvasNode = {
        id: newId,
        text: values.name,
        x: addNodePosition.x,
        y: addNodePosition.y,
      };
      setNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newId);
      setIsDirty(true);
      pendingNodeConfigsRef.current.set(newId, {
        name: values.name,
        description: values.description,
        artifacts: (values.artifacts ?? []).map((a) => ({
          id: `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          name: a.name,
          required: a.required ?? false,
        })),
      });
      setAddNodeModalOpen(false);
      addNodeForm.resetFields();
    } catch {
      /* 表单验证失败 */
    }
  }

  /* ════════════════
   * 节点操作
   * ════════════════ */

  /** 删除选中节点 */
  function handleDeleteNode() {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) =>
      prev.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      ),
    );
    pendingNodeConfigsRef.current.delete(selectedNodeId);
    setSelectedNodeId(null);
    setConnectFromNodeId(null);
    setIsDirty(true);
  }

  /** 点击节点 */
  function handleNodeClickInternal(nodeId: string) {
    const execution = execMap.get(nodeId);
    if (!canEdit) {
      if (execution) onNodeClick(execution);
      return;
    }
    if (connectFromNodeId && connectFromNodeId !== nodeId) {
      setEdges((prev) => [
        ...prev,
        { source: connectFromNodeId, target: nodeId },
      ]);
      setConnectFromNodeId(null);
      setSelectedNodeId(nodeId);
      setIsDirty(true);
      return;
    }
    setSelectedNodeId(nodeId);
  }

  /** 构建保存载荷 */
  function buildSavePayload(): UpdateFlowDraftDto {
    const nodeIdSet = new Set(nodes.map((n) => n.id));
    const validEdges = linkedEdges.filter(
      (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target),
    );
    const predecessorMap = new Map<string, string[]>();
    nodes.forEach((n) => predecessorMap.set(n.id, []));
    for (const edge of validEdges) {
      const preds = predecessorMap.get(edge.target);
      if (!preds) {
        predecessorMap.set(edge.target, [edge.source]);
      } else if (!preds.includes(edge.source)) {
        preds.push(edge.source);
      }
    }
    const configMap = new Map(
      flowDefinition.nodesConfig.map((c) => [c.nodeId, c]),
    );
    return {
      graphJson: {
        nodes: nodes.map((n) => ({
          id: n.id,
          text: n.text,
          x: Math.round(n.x),
          y: Math.round(n.y),
        })),
        edges: validEdges,
      },
      nodesConfig: nodes.map((n) => {
        const existing = configMap.get(n.id);
        const pending = pendingNodeConfigsRef.current.get(n.id);
        return {
          nodeId: n.id,
          name: pending?.name ?? existing?.name ?? n.text,
          requiredArtifacts: pending
            ? pending.artifacts.map((a) => ({
                id: a.id,
                name: a.name,
                required: a.required,
              }))
            : (existing?.requiredArtifacts.map((a) => ({
                id: a.id,
                name: a.name,
                required: a.required,
                sourceType: a.sourceType,
              })) ?? []),
          predecessorNodeIds: predecessorMap.get(n.id) ?? [],
        };
      }),
    };
  }

  /** 保存草稿 */
  function handleSave() {
    if (!onSaveDraft) return;
    onSaveDraft(buildSavePayload());
    pendingNodeConfigsRef.current.clear();
    setIsDirty(false);
  }

  /* 空节点提示 */
  if (nodes.length === 0 && !canEdit) {
    return (
      <div
        className="flow-canvas-wrapper"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text type="secondary">
          流程尚未配置节点，请切换到编辑模式。
        </Text>
      </div>
    );
  }

  return (
    <div className="flow-canvas-wrapper">
      {/* ─── 画布顶部工具栏 ─── */}
      {canEdit && (
        <div className="flow-canvas-toolbar">
          <Space size={8} wrap>
            <Tag color="gold">编辑模式</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              双击空白处新增节点 · 拖拽节点移动 · 点击节点后连线
            </Text>
            <Button
              size="small"
              icon={<DeleteOutlined />}
              disabled={!selectedNodeId}
              onClick={handleDeleteNode}
            >
              删除节点
            </Button>
            <Button
              size="small"
              icon={connectFromNodeId ? <StopOutlined /> : <LinkOutlined />}
              disabled={!selectedNodeId}
              onClick={() =>
                setConnectFromNodeId((prev) =>
                  prev ? null : selectedNodeId,
                )
              }
            >
              {connectFromNodeId ? '取消连线' : '发起连线'}
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!isDirty}
              onClick={handleSave}
            >
              保存草稿
            </Button>
            {connectFromNodeId && (
              <Text type="warning" style={{ fontSize: 12 }}>
                请点击目标节点完成连线
              </Text>
            )}
          </Space>
        </div>
      )}

      {!canEdit && (
        <div className="flow-canvas-toolbar">
          <Space size={8}>
            <Tag color="blue">执行模式</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              点击节点查看详情 · 拖动画布平移
            </Text>
          </Space>
        </div>
      )}

      {/* ─── 画布主体（可平移） ─── */}
      <div
        ref={canvasRef}
        className="flow-canvas-container"
        style={{
          cursor: isPanning ? 'grabbing' : 'grab',
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
        }}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleCanvasDoubleClick}
        onClick={() => {
          if (canEdit) setSelectedNodeId(null);
        }}
      >
        {/* 变换层：受平移偏移影响 */}
        <div
          className="flow-canvas-transform"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          {/* SVG 连线层 */}
          <svg className="flow-canvas-edges" aria-hidden>
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
              const src = nodes.find((n) => n.id === edge.source);
              const tgt = nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;
              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={src.x + NODE_WIDTH / 2}
                  y1={src.y + NODE_HEIGHT / 2}
                  x2={tgt.x + NODE_WIDTH / 2}
                  y2={tgt.y + NODE_HEIGHT / 2}
                  stroke="#8c8c8c"
                  strokeWidth={1.5}
                  markerEnd="url(#flow-arrow)"
                />
              );
            })}
          </svg>

          {/* 节点层 */}
          {nodes.map((node) => {
            const execution = execMap.get(node.id);
            const selected = selectedNodeId === node.id;
            const highlighted =
              execution?.executionId === selectedExecutionId;
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
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClickInternal(node.id);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                role="button"
              >
                <Text strong style={{ fontSize: 14, display: 'block' }}>
                  {node.text}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {execution
                    ? STATUS_LABEL[execution.status]
                    : '未生成执行实例'}
                </Text>
                {canEdit && selected && (
                  <Text
                    type="secondary"
                    style={{ fontSize: 11, marginTop: 6 }}
                  >
                    ID: {node.id}
                  </Text>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 双击新增节点弹窗 ─── */}
      <Modal
        title="新增流程节点"
        open={addNodeModalOpen}
        onCancel={() => {
          setAddNodeModalOpen(false);
          addNodeForm.resetFields();
        }}
        onOk={handleAddNodeConfirm}
        okText="创建节点"
        cancelText="取消"
        destroyOnClose
        width={520}
      >
        <Form
          form={addNodeForm}
          layout="vertical"
          initialValues={{ artifacts: [] }}
        >
          <Form.Item
            label="节点名称"
            name="name"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input
              placeholder="例如：需求评审"
              autoFocus
              maxLength={50}
            />
          </Form.Item>
          <Form.Item label="节点描述" name="description">
            <Input.TextArea
              placeholder="可选：简要说明该节点职责"
              rows={2}
              maxLength={200}
            />
          </Form.Item>
          <Divider orientation="left" style={{ fontSize: 13 }}>
            输出物要求（可选）
          </Divider>
          <Form.List name="artifacts">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space
                    key={key}
                    align="baseline"
                    style={{ display: 'flex', marginBottom: 8 }}
                  >
                    <Form.Item
                      {...rest}
                      name={[name, 'name']}
                      rules={[
                        { required: true, message: '请输入名称' },
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input
                        placeholder="输出物名称"
                        style={{ width: 260 }}
                        maxLength={50}
                      />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, 'required']}
                      valuePropName="checked"
                      initialValue={true}
                      style={{ marginBottom: 0 }}
                    >
                      <label
                        style={{ fontSize: 13, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          defaultChecked
                          style={{ marginRight: 4 }}
                          onChange={(e) => {
                            addNodeForm.setFieldValue(
                              ['artifacts', name, 'required'],
                              e.target.checked,
                            );
                          }}
                        />
                        必需
                      </label>
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => remove(name)}
                      style={{ color: '#ff4d4f', cursor: 'pointer' }}
                    />
                  </Space>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ name: '', required: true })}
                  icon={<PlusOutlined />}
                  block
                >
                  添加输出物
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
