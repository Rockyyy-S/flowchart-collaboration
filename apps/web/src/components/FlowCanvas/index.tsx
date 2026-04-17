import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Divider,
  Dropdown,
  Form,
  Input,
  message,
  Modal,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  AimOutlined,
  DeleteOutlined,
  FlagOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type {
  ExecutionStatus,
  FlowDefinition,
  NodeExecution,
  NodeType,
  UpdateFlowDraftDto,
} from '../../api/types';
import dayjs from 'dayjs';

const { Text } = Typography;

/** 优先级色点颜色映射 */
const PRIORITY_DOT_COLOR: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#3b82f6',
  HIGH: '#f97316',
  URGENT: '#ef4444',
};

/** 节点卡片常量 */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 96;

/** 多人节点（圆形）常量 */
const CIRCLE_DIAMETER = 120;
const CIRCLE_RADIUS = CIRCLE_DIAMETER / 2;

/** 起始节点（椭圆）常量 */
const START_WIDTH = 160;
const START_HEIGHT = 72;

/** 终止节点（同心圆）常量 */
const END_DIAMETER = 100;

/** 画布内部节点模型 */
interface CanvasNode {
  id: string;
  text: string;
  x: number;
  y: number;
  /** 节点类型，默认 TASK */
  type: NodeType;
}

interface FlowCanvasProps {
  flowDefinition: FlowDefinition;
  executions: NodeExecution[];
  selectedExecutionId?: string;
  mode?: 'view' | 'edit';
  saving?: boolean;
  onSaveDraft?: (dto: UpdateFlowDraftDto) => void;
  onNodeClick: (execution: NodeExecution) => void;
  /** 是否允许切换模式（仅 OWNER） */
  canSwitchMode?: boolean;
  /** 模式切换回调 */
  onModeChange?: (mode: 'view' | 'edit') => void;
  /** 刷新回调 */
  onRefresh?: () => void;
}

/** 状态中文映射 */
const STATUS_LABEL: Record<ExecutionStatus, string> = {
  PENDING: '待启动',
  READY: '可开始',
  IN_PROGRESS: '进行中',
  GATE_CHECKING: '门禁检查中',
  COMPLETED: '已完成',
  NEEDS_FIX: '待补齐',
};

/** 状态对应图标 Emoji（轻量，无需引入额外图标） */
const STATUS_EMOJI: Record<ExecutionStatus, string> = {
  PENDING: '⏳',
  READY: '🟢',
  IN_PROGRESS: '🔧',
  GATE_CHECKING: '🔍',
  COMPLETED: '✅',
  NEEDS_FIX: '🔴',
};

/**
 * 计算从矩形中心朝目标方向与矩形边缘的交点
 * 用于让连线从节点边缘出发/到达，而非穿过节点中心
 */
function getEdgePoint(
  cx: number, cy: number,
  halfW: number, halfH: number,
  tx: number, ty: number,
) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  // 判断射线先与水平边相交还是垂直边相交
  if (absDx * halfH > absDy * halfW) {
    // 交左/右边
    const sign = dx > 0 ? 1 : -1;
    return { x: cx + sign * halfW, y: cy + (dy / absDx) * halfW };
  } else {
    // 交上/下边
    const sign = dy > 0 ? 1 : -1;
    return { x: cx + (dx / absDy) * halfH, y: cy + sign * halfH };
  }
}

/**
 * 计算从圆形中心朝目标方向与圆形边缘的交点
 * 用于圆形节点的通用连线碰撞计算
 */
function getCircleEdgePoint(
  cx: number, cy: number, radius: number,
  tx: number, ty: number,
) {
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { x: cx, y: cy };
  return { x: cx + (dx / dist) * radius, y: cy + (dy / dist) * radius };
}

/**
 * 计算从椭圆中心朝目标方向与椭圆边缘的交点
 * 用于起始节点（椭圆形）的连线碰撞计算
 * @param a 椭圆水平半轴长
 * @param b 椭圆垂直半轴长
 */
function getEllipseEdgePoint(
  cx: number, cy: number,
  a: number, b: number,
  tx: number, ty: number,
) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const angle = Math.atan2(dy, dx);
  return {
    x: cx + a * Math.cos(angle),
    y: cy + b * Math.sin(angle),
  };
}

/** 判定是否为多人节点（assignees > 1 时渲染为圆形） */
function isMultiAssignee(config?: { assignees?: string[] }): boolean {
  return (config?.assignees?.length ?? 0) > 1;
}

/**
 * 获取节点形状与尺寸信息（统一用于碰撞检测、布局计算）
 */
function getNodeShape(
  nodeType: NodeType,
  config?: { assignees?: string[] },
): { width: number; height: number; shape: 'ellipse' | 'circle' | 'rect' } {
  if (nodeType === 'START') return { width: START_WIDTH, height: START_HEIGHT, shape: 'ellipse' };
  if (nodeType === 'END') return { width: END_DIAMETER, height: END_DIAMETER, shape: 'circle' };
  if (isMultiAssignee(config)) return { width: CIRCLE_DIAMETER, height: CIRCLE_DIAMETER, shape: 'circle' };
  return { width: NODE_WIDTH, height: NODE_HEIGHT, shape: 'rect' };
}

/** 规范化节点位置，确保每个节点都有 x/y 和 type */
function normalizeCanvasNodes(
  nodes: FlowDefinition['graphJson']['nodes'],
): CanvasNode[] {
  return nodes.map((node, idx) => ({
    id: node.id,
    text: node.text,
    x: node.x ?? 120 + (idx % 4) * 220,
    y: node.y ?? 80 + Math.floor(idx / 4) * 150,
    type: node.type ?? 'TASK',
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
  canSwitchMode,
  onModeChange,
  onRefresh,
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
    /** 被拖拽节点的宽高（用于拖拽插入检测） */
    nodeWidth: number;
    nodeHeight: number;
  } | null>(null);
  /* 正在拖拽的节点ID（用于增强拖拽视觉反馈） */
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  /* ── 拖拽插入候选边 ── */
  const [insertTargetEdge, setInsertTargetEdge] = useState<{ source: string; target: string } | null>(null);
  const insertTargetEdgeRef = useRef<{ source: string; target: string } | null>(null);

  /* ── 新增节点弹窗 ── */
  const [addNodeModalOpen, setAddNodeModalOpen] = useState(false);
  const [addNodePosition, setAddNodePosition] = useState({ x: 0, y: 0 });
  const [addNodeForm] = Form.useForm<AddNodeFormValues>();
  /** 当前正在新增的节点类型 */
  const [addNodeType, setAddNodeType] = useState<NodeType>('TASK');

  /* 是否已有终止节点（用于工具栏按钮显隐和终止节点创建限制） */
  const hasEndNode = useMemo(() => nodes.some((n) => n.type === 'END'), [nodes]);

  /* nodeId -> execution 映射 */
  const execMap = useMemo(() => {
    const map = new Map<string, NodeExecution>();
    executions.forEach((e) => map.set(e.nodeId, e));
    return map;
  }, [executions]);

  /* nodeId -> nodeConfig 映射（用于在画布节点上展示配置信息） */
  const nodeConfigMap = useMemo(() => {
    const map = new Map<string, (typeof flowDefinition.nodesConfig)[number]>();
    flowDefinition.nodesConfig.forEach((c) => map.set(c.nodeId, c));
    return map;
  }, [flowDefinition.nodesConfig]);

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

  /* refs 用于在全局鼠标事件（useEffect）中访问最新状态 */
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const linkedEdgesRef = useRef(linkedEdges);
  linkedEdgesRef.current = linkedEdges;
  const nodeConfigMapRef = useRef(nodeConfigMap);
  nodeConfigMapRef.current = nodeConfigMap;

  /* ═══════════════════════════════════
   * 画布拖动（Pan）和节点拖拽的统一鼠标事件
   * ═══════════════════════════════════ */

  /** 节点 mousedown —— 编辑模式下开始拖拽节点 */
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string, nodeW: number, nodeH: number) => {
      if (!canEdit) return;
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      draggingRef.current = {
        nodeId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        nodeWidth: nodeW,
        nodeHeight: nodeH,
      };
      setDraggingNodeId(nodeId);
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

        /* ── 拖拽插入检测：检查被拖拽节点是否靠近某条连线中点 ── */
        const dragW = draggingRef.current.nodeWidth;
        const dragH = draggingRef.current.nodeHeight;
        const dragCx = Math.max(0, logicX) + dragW / 2;
        const dragCy = Math.max(0, logicY) + dragH / 2;
        const dragNodeId = draggingRef.current.nodeId;
        const currentNodes = nodesRef.current;
        const currentEdges = linkedEdgesRef.current;
        let bestEdge: { source: string; target: string } | null = null;
        let bestDist = 60;
        for (const edge of currentEdges) {
          /* 跳过与被拖拽节点相关的边 */
          if (edge.source === dragNodeId || edge.target === dragNodeId) continue;
          const srcNode = currentNodes.find((n) => n.id === edge.source);
          const tgtNode = currentNodes.find((n) => n.id === edge.target);
          if (!srcNode || !tgtNode) continue;
          const srcShape = getNodeShape(srcNode.type, nodeConfigMapRef.current.get(srcNode.id));
          const tgtShape = getNodeShape(tgtNode.type, nodeConfigMapRef.current.get(tgtNode.id));
          const midX = (srcNode.x + srcShape.width / 2 + tgtNode.x + tgtShape.width / 2) / 2;
          const midY = (srcNode.y + srcShape.height / 2 + tgtNode.y + tgtShape.height / 2) / 2;
          const dist = Math.sqrt((dragCx - midX) ** 2 + (dragCy - midY) ** 2);
          if (dist < bestDist) {
            bestDist = dist;
            bestEdge = edge;
          }
        }
        insertTargetEdgeRef.current = bestEdge;
        setInsertTargetEdge(bestEdge);

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
      /* ── 拖拽插入：在释放时检查是否有候选插入边 ── */
      if (draggingRef.current && insertTargetEdgeRef.current) {
        const dragNodeId = draggingRef.current.nodeId;
        const { source, target } = insertTargetEdgeRef.current;
        const currentNodes = nodesRef.current;
        const srcNode = currentNodes.find((n) => n.id === source);
        const tgtNode = currentNodes.find((n) => n.id === target);
        if (srcNode && tgtNode) {
          const srcShape = getNodeShape(srcNode.type, nodeConfigMapRef.current.get(srcNode.id));
          const tgtShape = getNodeShape(tgtNode.type, nodeConfigMapRef.current.get(tgtNode.id));
          const midX = (srcNode.x + srcShape.width / 2 + tgtNode.x + tgtShape.width / 2) / 2;
          const midY = (srcNode.y + srcShape.height / 2 + tgtNode.y + tgtShape.height / 2) / 2;
          const dw = draggingRef.current.nodeWidth;
          const dh = draggingRef.current.nodeHeight;
          /* 更新被拖拽节点位置到连线中点 */
          setNodes((prev) =>
            prev.map((n) =>
              n.id === dragNodeId
                ? { ...n, x: midX - dw / 2, y: midY - dh / 2 }
                : n,
            ),
          );
          /* 删除原边，创建两条新边 */
          setEdges((prev) => {
            const filtered = prev.filter(
              (e) => !(e.source === source && e.target === target),
            );
            return uniqueEdges([
              ...filtered,
              { source, target: dragNodeId },
              { source: dragNodeId, target },
            ]);
          });
          setIsDirty(true);
        }
      }
      /* 清理拖拽插入状态 */
      insertTargetEdgeRef.current = null;
      setInsertTargetEdge(null);
      draggingRef.current = null;
      panningRef.current = null;
      setIsPanning(false);
      setDraggingNodeId(null);
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
      /* 第一个节点必须是起始节点 */
      const nodeType: NodeType = nodes.length === 0 ? 'START' : 'TASK';
      setAddNodeType(nodeType);
      setAddNodePosition({ x: logicX, y: logicY });
      setAddNodeModalOpen(true);
    },
    [canEdit, nodes.length],
  );

  /** 工具栏"添加终止节点" —— 在画布最后一个节点下方自动创建 */
  function handleAddEndNode() {
    if (hasEndNode || nodes.length === 0) return;
    const lastNode = nodes.reduce((a, b) => (a.y > b.y ? a : b));
    const lastShape = getNodeShape(lastNode.type, nodeConfigMap.get(lastNode.id));
    const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const newNode: CanvasNode = {
      id: newId,
      text: '终止',
      x: lastNode.x + (lastShape.width - END_DIAMETER) / 2,
      y: lastNode.y + lastShape.height + 150,
      type: 'END',
    };
    setNodes((prev) => [...prev, newNode]);
    pendingNodeConfigsRef.current.set(newId, {
      name: '终止',
      type: 'END',
      artifacts: [],
    });
    setIsDirty(true);
  }

  /** 添加子流程节点（向上或向下并行分支） */
  function handleAddSubprocess(parentNodeId: string, direction: 'up' | 'down') {
    const parentNode = nodes.find((n) => n.id === parentNodeId);
    if (!parentNode) return;
    const parentConfig = nodeConfigMap.get(parentNodeId);
    const parentShape = getNodeShape(parentNode.type, parentConfig);
    const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const newName = `子流程-${nodes.length + 1}`;
    const newEdgesToAdd: Array<{ source: string; target: string }> = [];
    let newX: number;
    let newY: number;

    if (direction === 'up') {
      /* 向上添加：在父节点左上方 */
      newX = parentNode.x - 250;
      newY = parentNode.y - NODE_HEIGHT - 80;
      /* 新子流程节点 → 父节点 */
      newEdgesToAdd.push({ source: newId, target: parentNodeId });
    } else {
      /* 向下添加：在父节点左下方 */
      newX = parentNode.x - 250;
      newY = parentNode.y + parentShape.height + 80;
      /* 父节点 → 新子流程节点 */
      newEdgesToAdd.push({ source: parentNodeId, target: newId });
      /* 新子流程节点 → 父节点的所有后继（保留原连线） */
      const successors = edges.filter((e) => e.source === parentNodeId).map((e) => e.target);
      for (const succ of successors) {
        newEdgesToAdd.push({ source: newId, target: succ });
      }
    }

    const newNode: CanvasNode = {
      id: newId,
      text: newName,
      x: newX,
      y: newY,
      type: 'TASK',
    };
    setNodes((prev) => [...prev, newNode]);
    setEdges((prev) => uniqueEdges([...prev, ...newEdgesToAdd]));
    pendingNodeConfigsRef.current.set(newId, {
      name: newName,
      type: 'TASK',
      isSubProcess: true,
      artifacts: [],
    });
    setIsDirty(true);
    setSelectedNodeId(newId);
  }

  /* 暂存新增节点的配置信息（随下次保存一并提交） */
  const pendingNodeConfigsRef = useRef<
    Map<
      string,
      {
        name: string;
        description?: string;
        /** 执行人列表 */
        assignees?: string[];
        /** 截止时间 */
        dueDate?: string;
        /** 优先级 */
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        /** 预估工时（小时） */
        estimatedHours?: number;
        /** 节点类型 */
        type?: NodeType;
        /** 是否为子流程节点（后续样式区分用） */
        isSubProcess?: boolean;
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
        type: addNodeType,
      };
      setNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newId);
      setIsDirty(true);
      pendingNodeConfigsRef.current.set(newId, {
        name: values.name,
        description: values.description,
        /* 新增字段默认值（暂不在新建弹窗中编辑，保留 undefined） */
        assignees: undefined,
        dueDate: undefined,
        priority: undefined,
        estimatedHours: undefined,
        type: addNodeType,
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

  /** 删除选中节点（智能重连：自动把前驱连接到后继） */
  function handleDeleteNode() {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node?.type === 'START') {
      message.warning('起始节点不可删除');
      return;
    }
    if (node?.type === 'END') {
      message.warning('终止节点不可删除');
      return;
    }
    /* 找出被删节点的所有前驱和后继 */
    const predecessors = edges.filter((e) => e.target === selectedNodeId).map((e) => e.source);
    const successors = edges.filter((e) => e.source === selectedNodeId).map((e) => e.target);
    /* 创建前驱→后继的新边（自动重连） */
    const reconnectEdges: Array<{ source: string; target: string }> = [];
    for (const pred of predecessors) {
      for (const succ of successors) {
        if (pred !== succ) {
          reconnectEdges.push({ source: pred, target: succ });
        }
      }
    }
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) =>
      uniqueEdges([
        ...prev.filter(
          (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
        ),
        ...reconnectEdges,
      ]),
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
          type: n.type,
        })),
        edges: validEdges,
      },
      nodesConfig: nodes.map((n) => {
        const existing = configMap.get(n.id);
        const pending = pendingNodeConfigsRef.current.get(n.id);
        return {
          nodeId: n.id,
          name: pending?.name ?? existing?.name ?? n.text,
          type: pending?.type ?? existing?.type ?? n.type,
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
          /* 透传新增的配置字段（新建节点或已有节点均保留） */
          assignees: pending?.assignees ?? existing?.assignees,
          dueDate: pending?.dueDate ?? existing?.dueDate,
          description: pending?.description ?? existing?.description,
          priority: pending?.priority ?? existing?.priority,
          estimatedHours: pending?.estimatedHours ?? existing?.estimatedHours,
        };
      }),
    };
  }

  /** 聚焦画布中心 —— 计算所有节点的包围盒并将其中心对齐画布中心 */
  function handleCenterCanvas() {
    if (nodes.length === 0) return;
    const container = canvasRef.current;
    if (!container) return;
    // 计算所有节点的边界矩形（考虑不同节点形状的尺寸）
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const nc = nodeConfigMap.get(n.id);
      const shape = getNodeShape(n.type, nc);
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + shape.width > maxX) maxX = n.x + shape.width;
      if (n.y + shape.height > maxY) maxY = n.y + shape.height;
    }
    // 节点群中心
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    // 画布容器可视区域中心
    const { clientWidth, clientHeight } = container;
    const canvasCenterX = clientWidth / 2;
    const canvasCenterY = clientHeight / 2;
    // 计算让节点群中心对齐画布中心所需的偏移量
    setPanOffset({
      x: canvasCenterX - centerX,
      y: canvasCenterY - centerY,
    });
  }

  /** 保存草稿（含流程图有效性验证） */
  function handleSave() {
    if (!onSaveDraft) return;

    /* ── 流程图有效性验证（保存门禁） ── */
    const startNodes = nodes.filter((n) => n.type === 'START');
    const endNodes = nodes.filter((n) => n.type === 'END');

    if (startNodes.length === 0) {
      message.warning('流程图缺少起始节点，无法保存');
      return;
    }
    if (endNodes.length === 0) {
      message.warning('流程图缺少终止节点，无法保存');
      return;
    }

    // 校验 START 节点：入边 = 0、出边 = 1
    for (const start of startNodes) {
      const inEdges = linkedEdges.filter((e) => e.target === start.id);
      const outEdges = linkedEdges.filter((e) => e.source === start.id);
      if (inEdges.length > 0) {
        message.warning(`起始节点"${start.text}"不能有入边`);
        return;
      }
      if (outEdges.length !== 1) {
        message.warning(`起始节点"${start.text}"必须恰好有一条出边（当前 ${outEdges.length} 条）`);
        return;
      }
    }

    // 校验 END 节点：出边 = 0、入边 >= 1
    for (const end of endNodes) {
      const inEdges = linkedEdges.filter((e) => e.target === end.id);
      const outEdges = linkedEdges.filter((e) => e.source === end.id);
      if (outEdges.length > 0) {
        message.warning(`终止节点"${end.text}"不能有出边`);
        return;
      }
      if (inEdges.length < 1) {
        message.warning(`终止节点"${end.text}"至少需要一条入边`);
        return;
      }
    }

    onSaveDraft(buildSavePayload());
    pendingNodeConfigsRef.current.clear();
    setIsDirty(false);
  }

  /* 空节点提示 —— 美化引导 */
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
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>📋</div>
          <Text type="secondary" style={{ fontSize: 14 }}>
            流程尚未配置节点，请切换到编辑模式添加
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-canvas-wrapper">
      {/* ─── 统一工具栏：模式切换（左侧固定）+ 操作按钮（右侧按模式切换） ─── */}
      <div className={`flow-canvas-toolbar ${canEdit ? 'flow-canvas-toolbar--edit' : 'flow-canvas-toolbar--view'}`}>
        {/* 左侧固定区域：模式切换 + 刷新 */}
        <div className="flow-canvas-toolbar-mode">
          {canSwitchMode && onModeChange && (
            <Segmented
              size="small"
              value={mode}
              options={[
                { label: '执行模式', value: 'view' },
                { label: '编辑模式', value: 'edit' },
              ]}
              onChange={(v) => onModeChange(v as 'view' | 'edit')}
            />
          )}
          {onRefresh && (
            <Text
              style={{ fontSize: 12, cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 500 }}
              onClick={onRefresh}
            >
              <ReloadOutlined /> 刷新
            </Text>
          )}
        </div>

        <Divider type="vertical" style={{ margin: '0 8px', height: 24 }} />

        {/* 右侧：按模式动态切换的操作区 + 提示文字，带过渡动画 */}
        <div
          key={mode}
          className="flow-canvas-toolbar-actions"
        >
          {canEdit ? (
            <Space size={8} wrap>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                disabled={!selectedNodeId}
                onClick={handleDeleteNode}
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                删除
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
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {connectFromNodeId ? '取消连线' : '连线'}
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={!isDirty}
                onClick={handleSave}
                style={{ borderRadius: 'var(--radius-sm)', fontWeight: 500 }}
              >
                保存草稿
              </Button>
              {/* 仅当流程中尚无终止节点时显示 */}
              {!hasEndNode && nodes.length > 0 && (
                <Button
                  size="small"
                  icon={<FlagOutlined />}
                  onClick={handleAddEndNode}
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  添加终止节点
                </Button>
              )}
              {connectFromNodeId && (
                <Tag color="warning" style={{ borderRadius: 'var(--radius-sm)' }}>
                  请点击目标节点完成连线
                </Tag>
              )}
            </Space>
          ) : null}
        </div>

        {/* 最右侧：轻量操作提示 */}
        <Text className="flow-canvas-toolbar-hint" type="secondary">
          {canEdit
            ? '双击空白处新增 · 拖拽移动 · 点击后连线'
            : '点击节点查看详情 · 拖动画布平移'}
        </Text>
      </div>

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
        {/* 悬浮居中按钮 —— 画布左上角 */}
        <Button
          className="flow-canvas-center-btn"
          size="small"
          icon={<AimOutlined />}
          onClick={handleCenterCanvas}
        >
          居中
        </Button>

        {/* 变换层：受平移偏移影响 */}
        <div
          className="flow-canvas-transform"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          {/* SVG 连线层 —— 贝塞尔曲线 + 流动动画 */}
          <svg className="flow-canvas-edges" aria-hidden>
            <defs>
              <marker
                id="flow-arrow"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 8 4, 0 8" fill="#94a3b8" />
              </marker>
              {/* 连线渐变色 */}
              <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
            </defs>
            {linkedEdges.map((edge) => {
              const src = nodes.find((n) => n.id === edge.source);
              const tgt = nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;

              /* 获取两端节点的形状信息（统一处理矩形、圆形、椭圆） */
              const srcConfig = nodeConfigMap.get(edge.source);
              const tgtConfig = nodeConfigMap.get(edge.target);
              const srcShape = getNodeShape(src.type, srcConfig);
              const tgtShape = getNodeShape(tgt.type, tgtConfig);

              /* 计算各节点中心坐标 */
              const srcCx = src.x + srcShape.width / 2;
              const srcCy = src.y + srcShape.height / 2;
              const tgtCx = tgt.x + tgtShape.width / 2;
              const tgtCy = tgt.y + tgtShape.height / 2;

              /* 多人圆形节点特殊处理：出边底部、入边顶部（分叉视觉） */
              const srcIsMulti = src.type === 'TASK' && isMultiAssignee(srcConfig);
              const tgtIsMulti = tgt.type === 'TASK' && isMultiAssignee(tgtConfig);

              /* 计算连线端点 —— 按节点形状选择不同碰撞计算 */
              let p1: { x: number; y: number };
              let p2: { x: number; y: number };

              /* 源节点出边点 */
              if (srcIsMulti) {
                p1 = { x: srcCx, y: srcCy + CIRCLE_RADIUS };
              } else if (srcShape.shape === 'ellipse') {
                p1 = getEllipseEdgePoint(srcCx, srcCy, srcShape.width / 2, srcShape.height / 2, tgtCx, tgtCy);
              } else if (srcShape.shape === 'circle') {
                p1 = getCircleEdgePoint(srcCx, srcCy, srcShape.width / 2, tgtCx, tgtCy);
              } else {
                const aimY = tgtIsMulti ? tgtCy - CIRCLE_RADIUS : tgtCy;
                p1 = getEdgePoint(srcCx, srcCy, NODE_WIDTH / 2, NODE_HEIGHT / 2, tgtCx, aimY);
              }

              /* 目标节点入边点 */
              if (tgtIsMulti) {
                p2 = { x: tgtCx, y: tgtCy - CIRCLE_RADIUS };
              } else if (tgtShape.shape === 'ellipse') {
                p2 = getEllipseEdgePoint(tgtCx, tgtCy, tgtShape.width / 2, tgtShape.height / 2, srcCx, srcCy);
              } else if (tgtShape.shape === 'circle') {
                p2 = getCircleEdgePoint(tgtCx, tgtCy, tgtShape.width / 2, srcCx, srcCy);
              } else {
                const aimY = srcIsMulti ? srcCy + CIRCLE_RADIUS : srcCy;
                p2 = getEdgePoint(tgtCx, tgtCy, NODE_WIDTH / 2, NODE_HEIGHT / 2, srcCx, aimY);
              }

              const x1 = p1.x, y1 = p1.y;
              const x2 = p2.x, y2 = p2.y;
              /* 贝塞尔控制点：垂直分量偏移 */
              const dx = Math.abs(x2 - x1);
              const dy = Math.abs(y2 - y1);
              const curvature = Math.min(dx, dy) * 0.4 + 30;
              /* 判断主方向（竖向还是横向） */
              const isMainlyVertical = dy > dx;
              const cx1 = isMainlyVertical ? x1 : x1 + curvature * Math.sign(x2 - x1);
              const cy1 = isMainlyVertical ? y1 + curvature * Math.sign(y2 - y1) : y1;
              const cx2 = isMainlyVertical ? x2 : x2 - curvature * Math.sign(x2 - x1);
              const cy2 = isMainlyVertical ? y2 - curvature * Math.sign(y2 - y1) : y2;

              /* 是否为活跃连线（两端节点有执行中状态） */
              const srcExec = execMap.get(edge.source);
              const tgtExec = execMap.get(edge.target);
              const isAnimated = srcExec?.status === 'COMPLETED' && (tgtExec?.status === 'IN_PROGRESS' || tgtExec?.status === 'READY');

              /* 是否为拖拽插入候选边 */
              const isInsertTarget = insertTargetEdge?.source === edge.source && insertTargetEdge?.target === edge.target;

              return (
                <path
                  key={`${edge.source}-${edge.target}`}
                  d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                  className={`flow-edge ${isAnimated ? 'flow-edge-animated' : ''} ${isInsertTarget ? 'flow-edge-insert-highlight' : ''}`}
                  markerEnd="url(#flow-arrow)"
                />
              );
            })}
          </svg>

          {/* 节点层 —— 支持起始/终止/多人圆形/矩形四种形态 */}
          {nodes.map((node) => {
            const execution = execMap.get(node.id);
            const nConfig = nodeConfigMap.get(node.id);
            const selected = selectedNodeId === node.id;
            const highlighted =
              execution?.executionId === selectedExecutionId;
            const statusClass = execution
              ? `node-card-${execution.status}`
              : 'node-card-PENDING';
            const isDragging = draggingNodeId === node.id;

            /* 根据节点类型判定形状与尺寸 */
            const nodeType = node.type ?? 'TASK';
            const isStart = nodeType === 'START';
            const isEnd = nodeType === 'END';
            /* START/END 节点不参与多人圆形判定 */
            const isCircle = !isStart && !isEnd && isMultiAssignee(nConfig);
            const shapeInfo = getNodeShape(nodeType, nConfig);
            const nodeW = shapeInfo.width;
            const nodeH = shapeInfo.height;

            /* 终止节点完成状态判定 */
            const isEndCompleted = isEnd && execution?.status === 'COMPLETED';

            /* 构建 CSS 类名 */
            const typeClass = isStart
              ? 'real-flow-node--start'
              : isEnd
              ? `real-flow-node--end${isEndCompleted ? ' real-flow-node--end-completed' : ''}`
              : isCircle
              ? 'real-flow-node--circle'
              : '';

            return (
              <div
                key={node.id}
                className={`real-flow-node ${statusClass} ${typeClass} ${isDragging ? 'real-flow-node--dragging' : ''}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: nodeW,
                  height: nodeH,
                  boxShadow: selected
                    ? 'var(--shadow-glow)'
                    : highlighted
                    ? '0 0 0 3px rgba(245, 158, 11, 0.18)'
                    : undefined,
                  cursor: canEdit ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                  zIndex: isDragging ? 100 : selected ? 10 : 1,
                  /* 子流程按钮需要溢出节点边界，编辑模式下 TASK 节点允许 overflow */
                  overflow: canEdit && !isStart && !isEnd ? 'visible' : undefined,
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id, nodeW, nodeH)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClickInternal(node.id);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                role="button"
              >
                {isStart ? (
                  /* 起始节点（椭圆）：节点名 + 起始标签 + 已就绪资料数量 */
                  <>
                    <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.3 }}>
                      {node.text}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.2 }}>🚀 起始</Text>
                    {nConfig?.requiredArtifacts && nConfig.requiredArtifacts.length > 0 && (
                      <Text type="secondary" style={{ fontSize: 9, lineHeight: 1.2, opacity: 0.7 }}>
                        📄 {nConfig.requiredArtifacts.length} 项已就绪资料
                      </Text>
                    )}
                  </>
                ) : isEnd ? (
                  /* 终止节点（同心圆）：居中"终止"标签 + 完成状态 */
                  <>
                    <Text strong style={{ fontSize: 12, display: 'block', lineHeight: 1.3, position: 'relative', zIndex: 1 }}>
                      终止
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.2, position: 'relative', zIndex: 1 }}>
                      {isEndCompleted ? '✅ 已完成' : '⏳ 未完成'}
                    </Text>
                  </>
                ) : isCircle ? (
                  /* 圆形节点：紧凑居中内容 */
                  <>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>
                      {execution ? STATUS_EMOJI[execution.status] : '⏳'}
                    </span>
                    <Text strong style={{ fontSize: 12, display: 'block', lineHeight: 1.3, maxWidth: CIRCLE_DIAMETER - 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.text}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.2 }}>
                      {execution ? STATUS_LABEL[execution.status] : '未生成'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 9, lineHeight: 1.2, opacity: 0.7 }}>
                      👥 {nConfig?.assignees?.length ?? 0}人
                    </Text>
                  </>
                ) : (
                  /* 矩形节点：原有完整内容 */
                  <>
                    {/* 优先级色点 + 状态 Emoji 指示 */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                  {nConfig?.priority && (
                    <span
                      title={`优先级: ${nConfig.priority}`}
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: PRIORITY_DOT_COLOR[nConfig.priority] ?? '#94a3b8',
                        marginRight: 4,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ fontSize: 14, marginRight: 4 }}>
                    {execution ? STATUS_EMOJI[execution.status] : '⏳'}
                  </span>
                </div>
                <Text strong style={{ fontSize: 14, display: 'block' }}>
                  {node.text}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {execution
                    ? STATUS_LABEL[execution.status]
                    : '未生成执行实例'}
                </Text>
                {/* 截止日期（小字展示） */}
                {nConfig?.dueDate && (
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                    ⏰ {dayjs(nConfig.dueDate).format('MM-DD')}
                  </Text>
                )}
                {/* 执行人摘要 */}
                {nConfig?.assignees && nConfig.assignees.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                    👤 {nConfig.assignees[0]}{nConfig.assignees.length > 1 ? ` +${nConfig.assignees.length - 1}` : ''}
                  </Text>
                )}
                {canEdit && selected && (
                  <Text
                    type="secondary"
                    style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}
                  >
                    {node.id}
                  </Text>
                )}
                  </>
                )}
                {/* 子流程"+"按钮 —— 仅编辑模式下非 START/END 节点显示 */}
                {canEdit && !isStart && !isEnd && (
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'up', label: '⬆ 向上添加子流程' },
                        { key: 'down', label: '⬇ 向下添加子流程' },
                      ],
                      onClick: ({ key }) => {
                        handleAddSubprocess(node.id, key as 'up' | 'down');
                      },
                    }}
                    trigger={['click']}
                    placement="topRight"
                  >
                    <div
                      className="subprocess-add-btn"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      +
                    </div>
                  </Dropdown>
                )}
              </div>
            );
          })}

          {/* 拖拽插入提示标签 */}
          {insertTargetEdge && (() => {
            const srcNode = nodes.find((n) => n.id === insertTargetEdge.source);
            const tgtNode = nodes.find((n) => n.id === insertTargetEdge.target);
            if (!srcNode || !tgtNode) return null;
            const srcShape = getNodeShape(srcNode.type, nodeConfigMap.get(srcNode.id));
            const tgtShape = getNodeShape(tgtNode.type, nodeConfigMap.get(tgtNode.id));
            const midX = (srcNode.x + srcShape.width / 2 + tgtNode.x + tgtShape.width / 2) / 2;
            const midY = (srcNode.y + srcShape.height / 2 + tgtNode.y + tgtShape.height / 2) / 2;
            return (
              <div
                className="insert-hint-label"
                style={{ left: midX, top: midY - 20 }}
              >
                释放插入
              </div>
            );
          })()}
        </div>
      </div>

      {/* ─── 双击新增节点弹窗（起始节点 vs 普通节点自适应） ─── */}
      <Modal
        title={addNodeType === 'START' ? '创建起始节点' : '新增流程节点'}
        open={addNodeModalOpen}
        onCancel={() => {
          setAddNodeModalOpen(false);
          addNodeForm.resetFields();
        }}
        onOk={handleAddNodeConfirm}
        okText={addNodeType === 'START' ? '创建起始节点' : '创建节点'}
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
            {addNodeType === 'START' ? '已就绪资料（已准备好的文档/资料）' : '输出物要求（可选）'}
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
                        placeholder={addNodeType === 'START' ? '资料名称' : '输出物名称'}
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
                  {addNodeType === 'START' ? '添加已就绪资料' : '添加输出物'}
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
