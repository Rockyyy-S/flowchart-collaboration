import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  DatePicker,
  Divider,
  Dropdown,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  AimOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  LinkOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  StopOutlined,
  WarningOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import type {
  ExecutionStatus,
  FlowDefinition,
  NodeExecution,
  NodeType,
  UpdateFlowDraftDto,
} from '../../api/types';
import { generateNodeId, buildNodeIdSet } from '../../utils/naming';
import dayjs from 'dayjs';

const { Text } = Typography;

/** 优先级色点颜色映射 */
const PRIORITY_DOT_COLOR: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#3b82f6',
  HIGH: '#f97316',
  URGENT: '#ef4444',
};

/** 节点卡片常量（统一圆角矩形语义） */
const NODE_WIDTH = 168;
/* 节点卡片高度：3行内容（头部+meta+footer）+ 上下各12px内边距，合计约96px才能完整展示 */
const NODE_HEIGHT = 96;
const BRANCH_NODE_WIDTH = 196;

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
  /** 是否允许切换编辑模式（仅 OWNER） */
  canSwitchMode?: boolean;
  /** 模式切换回调 */
  onModeChange?: (mode: 'view' | 'edit') => void;
  saving?: boolean;
  onSaveDraft?: (dto: UpdateFlowDraftDto) => void;
  onNodeClick: (execution: NodeExecution) => void;
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
  REJECTED: '被回退',
};

function renderStatusIcon(status?: ExecutionStatus) {
  switch (status) {
    case 'READY':
      return <PlayCircleOutlined className="flow-node-status-icon flow-node-status-icon--ready" />;
    case 'IN_PROGRESS':
      return <LoadingOutlined className="flow-node-status-icon flow-node-status-icon--progress" />;
    case 'GATE_CHECKING':
      return <LoadingOutlined className="flow-node-status-icon flow-node-status-icon--checking" />;
    case 'COMPLETED':
      return <CheckCircleOutlined className="flow-node-status-icon flow-node-status-icon--success" />;
    case 'NEEDS_FIX':
      return <WarningOutlined className="flow-node-status-icon flow-node-status-icon--warning" />;
    case 'REJECTED':
      return <CloseCircleOutlined className="flow-node-status-icon flow-node-status-icon--danger" />;
    case 'PENDING':
    default:
      return <ClockCircleOutlined className="flow-node-status-icon flow-node-status-icon--pending" />;
  }
}

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

/** 兼容旧数据里的 TASK 类型 */
function normalizeNodeType(nodeType?: NodeType): NodeType {
  return nodeType === 'TASK' || !nodeType ? 'TASK_SIMPLE' : nodeType;
}

/**
 * 获取节点形状与尺寸信息（统一用于碰撞检测、布局计算）
 */
function getNodeShape(
  nodeType: NodeType,
): { width: number; height: number } {
  if (nodeType === 'TASK_BRANCH') return { width: BRANCH_NODE_WIDTH, height: NODE_HEIGHT };
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
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
    type: normalizeNodeType(node.type),
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
  nodeType?: NodeType;
  description?: string;
  assignees?: string[];
  dueDate?: dayjs.Dayjs;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedHours?: number;
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
  canSwitchMode = false,
  onModeChange,
  saving,
  onSaveDraft,
  onNodeClick,
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

  /* ── 画布缩放状态（1.0 = 100%，范围 0.1~3.0） ── */
  const [scale, setScale] = useState(1);

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

  /**
   * 拖拽过程中当前已激活的自动插入状态。
   * 记录被消耗（暂时删除）的原始边，用于切换候选边时还原。
   */
  const activeInsertionRef = useRef<{
    /** 被替换掉的原始边（还原时重新加回） */
    originalEdge: { source: string; target: string };
  } | null>(null);

  /* ── 新增节点弹窗 ── */
  const [addNodeModalOpen, setAddNodeModalOpen] = useState(false);
  const [addNodePosition, setAddNodePosition] = useState({ x: 0, y: 0 });
  const [addNodeForm] = Form.useForm<AddNodeFormValues>();
  /** 当前正在新增的节点类型 */
  const [addNodeType, setAddNodeType] = useState<NodeType>('TASK_SIMPLE');

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

  /* 从nodeConfig中提取所有assignees用作下拉选项 */
  const availableAssignees = useMemo(() => {
    const assigneeSet = new Set<string>();
    flowDefinition.nodesConfig.forEach((cfg) => {
      cfg.assignees?.forEach((id) => assigneeSet.add(id));
    });
    return Array.from(assigneeSet).sort();
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
  const canvasSummary = useMemo(() => ({
    totalNodes: nodes.length,
    totalEdges: linkedEdges.length,
    inProgress: executions.filter((item) => item.status === 'IN_PROGRESS').length,
  }), [executions, linkedEdges.length, nodes.length]);

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

  /* scale ref 用于在事件回调中访问最新缩放比例 */
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      /* 优先处理节点拖拽 */
      if (draggingRef.current) {
        /* 先快照拖拽状态，避免 mouseup 清空 ref 后异步回调读取空值 */
        const dragState = draggingRef.current;
        if (!dragState) return;
        const {
          nodeId: dragNodeId,
          offsetX,
          offsetY,
          nodeWidth: dragW,
          nodeHeight: dragH,
        } = dragState;
        const container = canvasRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const currentPan = panOffsetRef.current;
        /* 除以当前缩放比例，将屏幕坐标转换为逻辑坐标 */
        const currentScale = scaleRef.current;
        const logicX =
          (e.clientX - rect.left - currentPan.x - offsetX) / currentScale;
        const logicY =
          (e.clientY - rect.top - currentPan.y - offsetY) / currentScale;
        setNodes((prev) =>
          prev.map((node) =>
            node.id === dragNodeId
              ? { ...node, x: Math.max(0, logicX), y: Math.max(0, logicY) }
              : node,
          ),
        );
        setIsDirty(true);

        /* ── 拖拽插入检测：检查被拖拽节点是否靠近某条连线中点 ── */
        const dragCx = Math.max(0, logicX) + dragW / 2;
        const dragCy = Math.max(0, logicY) + dragH / 2;
        const currentNodes = nodesRef.current;
        const currentEdges = linkedEdgesRef.current;

        /* 起始/终止节点不允许通过拖拽插入到边中间 */
        const draggedNode = currentNodes.find((n) => n.id === dragNodeId);
        if (draggedNode && (draggedNode.type === 'START' || draggedNode.type === 'END')) {
          insertTargetEdgeRef.current = null;
          setInsertTargetEdge(null);
          return;
        }
        let bestEdge: { source: string; target: string } | null = null;
        let bestDist = 60;
        for (const edge of currentEdges) {
          /* 跳过与被拖拽节点相关的边 */
          if (edge.source === dragNodeId || edge.target === dragNodeId) continue;
          /* 跳过已被当前插入消耗的原始边（防止 React 异步更新导致重复检测） */
          const activeOrig = activeInsertionRef.current?.originalEdge;
          if (
            activeOrig &&
            edge.source === activeOrig.source &&
            edge.target === activeOrig.target
          ) continue;
          const srcNode = currentNodes.find((n) => n.id === edge.source);
          const tgtNode = currentNodes.find((n) => n.id === edge.target);
          if (!srcNode || !tgtNode) continue;
          const srcShape = getNodeShape(normalizeNodeType(srcNode.type));
          const tgtShape = getNodeShape(normalizeNodeType(tgtNode.type));
          const midX = (srcNode.x + srcShape.width / 2 + tgtNode.x + tgtShape.width / 2) / 2;
          const midY = (srcNode.y + srcShape.height / 2 + tgtNode.y + tgtShape.height / 2) / 2;
          const dist = Math.sqrt((dragCx - midX) ** 2 + (dragCy - midY) ** 2);
          if (dist < bestDist) {
            bestDist = dist;
            bestEdge = edge;
          }
        }
        /* ── 实时自动连线：候选边变化时先还原旧插入再应用新插入 ── */
        const prevInsertion = activeInsertionRef.current;
        const prevEdge = prevInsertion?.originalEdge ?? null;

        /* 判断候选边是否与当前激活插入一致（一致则无需重复操作） */
        const isSameEdge =
          bestEdge !== null &&
          prevEdge !== null &&
          bestEdge.source === prevEdge.source &&
          bestEdge.target === prevEdge.target;

        if (!isSameEdge) {
          setEdges((prev) => {
            let next = [...prev];

            if (prevEdge) {
              /* 还原旧插入：删除拖拽节点与旧边两端的临时连线，恢复原始边 */
              next = next.filter(
                (e) =>
                  !(e.source === prevEdge.source && e.target === dragNodeId) &&
                  !(e.source === dragNodeId && e.target === prevEdge.target),
              );
              next = [...next, prevEdge];
            }

            if (bestEdge) {
              /* 应用新插入：删除目标边，插入拖拽节点 */
              next = next.filter(
                (e) =>
                  !(e.source === bestEdge.source && e.target === bestEdge.target),
              );
              next = uniqueEdges([
                ...next,
                { source: bestEdge.source, target: dragNodeId },
                { source: dragNodeId, target: bestEdge.target },
              ]);
            } else {
              next = uniqueEdges(next);
            }

            return next;
          });
          /* 更新激活插入状态 */
          activeInsertionRef.current = bestEdge ? { originalEdge: bestEdge } : null;
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
      /* 拖拽结束：边连接已在拖拽过程中实时更新，此处仅清理状态 */
      activeInsertionRef.current = null;
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

  /* ── 滚轮缩放：绑定 non-passive wheel 事件实现缩放到鼠标位置 ── */
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      /* 向上滚动放大，向下滚动缩小 */
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const oldScale = scaleRef.current;
      const newScale = Math.min(Math.max(oldScale * factor, 0.1), 3);
      /* 缩放到鼠标位置：保持鼠标指向的逻辑点不变 */
      const newPanX = mouseX - (mouseX - panOffsetRef.current.x) * (newScale / oldScale);
      const newPanY = mouseY - (mouseY - panOffsetRef.current.y) * (newScale / oldScale);
      setScale(newScale);
      setPanOffset({ x: newPanX, y: newPanY });
    }
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  /* ── 初始加载：自动将流程图缩放适配并居中到画布 ── */
  useEffect(() => {
    requestAnimationFrame(() => {
      handleCenterCanvas();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      /* 除以当前缩放比例，将屏幕坐标转换为逻辑坐标 */
      const logicX = (e.clientX - rect.left - panOffsetRef.current.x) / scaleRef.current;
      const logicY = (e.clientY - rect.top - panOffsetRef.current.y) / scaleRef.current;
      /* 第一个节点必须是起始节点 */
      const nodeType: NodeType = nodes.length === 0 ? 'START' : 'TASK_SIMPLE';
      setAddNodeType(nodeType);
      addNodeForm.setFieldValue('nodeType', nodeType);
      setAddNodePosition({ x: logicX, y: logicY });
      setAddNodeModalOpen(true);
    },
    [addNodeForm, canEdit, nodes.length],
  );

  /** 工具栏新增节点：在当前视口中心弹出新增弹窗 */
  function handleQuickAddNode(type: NodeType) {
    if (!canEdit) return;
    const container = canvasRef.current;
    if (!container) return;
    /* 视口中心坐标转换为逻辑坐标（除以缩放比例） */
    const x = (container.clientWidth / 2 - panOffsetRef.current.x) / scaleRef.current - NODE_WIDTH / 2;
    const y = (container.clientHeight / 2 - panOffsetRef.current.y) / scaleRef.current - NODE_HEIGHT / 2;
    setAddNodeType(type);
    addNodeForm.setFieldValue('nodeType', type);
    setAddNodePosition({ x: Math.max(20, x), y: Math.max(20, y) });
    setAddNodeModalOpen(true);
  }

  /** 添加子流程节点（向上或向下并行分支） */
  function handleAddSubprocess(parentNodeId: string, direction: 'up' | 'down') {
    const parentNode = nodes.find((n) => n.id === parentNodeId);
    if (!parentNode) return;
    const parentShape = getNodeShape(normalizeNodeType(parentNode.type));
    const newName = `子流程-${nodes.length + 1}`;
    // 使用语义化的节点ID：基于节点名称生成，若重复则追加时间戳后缀
    const existingIds = buildNodeIdSet(nodes);
    const newId = generateNodeId(newName, existingIds);
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
      type: 'TASK_SIMPLE',
    };
    setNodes((prev) => [...prev, newNode]);
    setEdges((prev) => uniqueEdges([...prev, ...newEdgesToAdd]));
    pendingNodeConfigsRef.current.set(newId, {
      name: newName,
      type: 'TASK_SIMPLE',
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
      const assignees = values.assignees?.map((item) => item.trim()).filter(Boolean);
      // 使用语义化的节点ID：基于节点名称生成，若重复则追加时间戳后缀
      const existingIds = buildNodeIdSet(nodes);
      const newId = generateNodeId(values.name, existingIds);
      const resolvedType: NodeType = values.nodeType ?? addNodeType;
      const newNode: CanvasNode = {
        id: newId,
        text: values.name,
        x: addNodePosition.x,
        y: addNodePosition.y,
        type: resolvedType,
      };
      /* 注册新节点配置 */
      pendingNodeConfigsRef.current.set(newId, {
        name: values.name,
        description: values.description,
        /* 执行配置会直接影响节点执行链路，创建时允许一并补齐。 */
        assignees: assignees?.length ? assignees : undefined,
        dueDate: values.dueDate?.toISOString(),
        priority: values.priority,
        estimatedHours: values.estimatedHours,
        type: resolvedType,
        artifacts: (values.artifacts ?? []).map((a) => ({
          id: `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          name: a.name,
          required: a.required ?? false,
        })),
      });

      if (resolvedType === 'START') {
        /* 创建起始节点时，同步在其正下方自动生成终止节点（START+END 成对出现） */
        // 为END节点生成语义化ID（遵循 node_{slug} 格式标准）
        const endNodeIds = buildNodeIdSet([...nodes, newNode]);
        const endId = generateNodeId('END', endNodeIds);
        const endNode: CanvasNode = {
          id: endId,
          text: '结束',
          x: addNodePosition.x,
          y: addNodePosition.y + NODE_HEIGHT + 150,
          type: 'END',
        };
        pendingNodeConfigsRef.current.set(endId, {
          name: '结束',
          type: 'END',
          artifacts: [],
        });
        setNodes((prev) => [...prev, newNode, endNode]);
          /* 创建默认起止连线 */
          setEdges((prev) => uniqueEdges([...prev, { source: newId, target: endId }]));
      } else {
        setNodes((prev) => [...prev, newNode]);
      }

      setSelectedNodeId(newId);
      setIsDirty(true);
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

  /** 居中并适配画布 —— 计算所有节点包围盒，将其缩放居中到画布可视区域 */
  function handleCenterCanvas() {
    const currentNodes = nodesRef.current;
    if (currentNodes.length === 0) return;
    const container = canvasRef.current;
    if (!container) return;
    /* 计算所有节点的包围盒 */
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of currentNodes) {
      const shape = getNodeShape(normalizeNodeType(n.type));
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + shape.width > maxX) maxX = n.x + shape.width;
      if (n.y + shape.height > maxY) maxY = n.y + shape.height;
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const { clientWidth, clientHeight } = container;
    /* 计算适配缩放比例（带 80px 内边距，最大不超过 1.5） */
    const padding = 80;
    const fitScale = (contentW > 0 && contentH > 0)
      ? Math.min(
          (clientWidth - padding * 2) / contentW,
          (clientHeight - padding * 2) / contentH,
          1.5,
        )
      : 1;
    const clampedScale = Math.max(0.1, fitScale);
    /* 节点群中心 */
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    /* 使节点群中心对齐画布中心，同时应用适配缩放 */
    setScale(clampedScale);
    setPanOffset({
      x: clientWidth / 2 - centerX * clampedScale,
      y: clientHeight / 2 - centerY * clampedScale,
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
        <div className="flow-canvas-empty-state">
          <div className="flow-canvas-empty-state__icon">
            <AppstoreOutlined />
          </div>
          <Text className="flow-canvas-empty-state__title">
            这张流程图还没有节点
          </Text>
          <Text className="flow-canvas-empty-state__hint">
            切换到编辑模式后，可以从起始节点开始搭建你的交付流程。
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-canvas-wrapper">
      {/* ─── 统一工具栏：单行layout (flex row)，按钮统一高度和间距 ─── */}
      <div className={`flow-canvas-toolbar ${canEdit ? 'flow-canvas-toolbar--edit' : 'flow-canvas-toolbar--view'}`}>
        {/* Mode + Refresh + Add节点 + Delete + Connect + Save */}
        <div className="flow-canvas-toolbar-left">
          <div className="flow-canvas-toolbar-mode">
            <Text style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              编辑模式
            </Text>
            <Tooltip
              title={canSwitchMode ? '仅在编辑需求时开启' : '仅项目负责人可切换编辑模式'}
              placement="top"
            >
              <Switch
                size="small"
                checked={canEdit}
                disabled={!canSwitchMode || !onModeChange}
                onChange={(checked) => onModeChange?.(checked ? 'edit' : 'view')}
              />
            </Tooltip>
          </div>

          {onRefresh && (
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              style={{ borderRadius: 'var(--radius-sm)', height: 32 }}
            >
              刷新
            </Button>
          )}

          {canEdit && (
            <>
              <Dropdown
                menu={{
                  items: [
                    { key: 'TASK_SIMPLE', label: '无分支任务节点' },
                    { key: 'TASK_BRANCH', label: '有分支任务节点' },
                  ],
                  onClick: ({ key }) => handleQuickAddNode(key as NodeType),
                }}
                trigger={['click']}
              >
                <Button size="small" icon={<PlusOutlined />} style={{ borderRadius: 'var(--radius-sm)', height: 32 }}>
                  节点
                </Button>
              </Dropdown>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                disabled={!selectedNodeId}
                onClick={handleDeleteNode}
                style={{ borderRadius: 'var(--radius-sm)', height: 32 }}
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
                style={{ borderRadius: 'var(--radius-sm)', height: 32 }}
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
                style={{ borderRadius: 'var(--radius-sm)', fontWeight: 500, height: 32 }}
              >
                保存草稿
              </Button>

            </>
          )}

          {connectFromNodeId && (
            <Tag color="warning" style={{ borderRadius: 'var(--radius-sm)' }}>
              请点击目标节点完成连线
            </Tag>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* 统计信息 */}
        <div className="flow-canvas-toolbar-stats">
          <span className="flow-canvas-stat-pill">节点 {canvasSummary.totalNodes}</span>
          <span className="flow-canvas-stat-pill">连线 {canvasSummary.totalEdges}</span>
          <span className="flow-canvas-stat-pill is-highlight">进行中 {canvasSummary.inProgress}</span>
          {isDirty && <span className="flow-canvas-stat-pill is-warning">有未保存改动</span>}
        </div>

        {/* 提示信息 */}
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
          position: 'relative',
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

        {/* 缩放浮窗 —— 右上角 */}
        <div className="flow-canvas-zoom-floating">
          <Button
            type="text"
            size="small"
            icon={<ZoomInOutlined />}
            onClick={() => {
              const newScale = Math.min(scaleRef.current * 1.25, 3);
              setScale(newScale);
            }}
            style={{ borderRadius: 'var(--radius-sm)', height: 32, width: 32, padding: 0 }}
            title="放大 (Scroll up)"
          />
          <span
            className="flow-canvas-zoom-label"
            style={{ cursor: 'pointer', userSelect: 'none', padding: '0 8px', fontSize: 12 }}
            onClick={() => { setScale(1); }}
            title="点击重置为 100%"
          >
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="text"
            size="small"
            icon={<ZoomOutOutlined />}
            onClick={() => {
              const newScale = Math.max(scaleRef.current * 0.8, 0.1);
              setScale(newScale);
            }}
            style={{ borderRadius: 'var(--radius-sm)', height: 32, width: 32, padding: 0 }}
            title="缩小 (Scroll down)"
          />
        </div>

        {/* 变换层：受平移偏移影响 */}
        <div
          className="flow-canvas-transform"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
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
              const srcShape = getNodeShape(normalizeNodeType(src.type));
              const tgtShape = getNodeShape(normalizeNodeType(tgt.type));

              /* 计算各节点中心坐标 */
              const srcCx = src.x + srcShape.width / 2;
              const srcCy = src.y + srcShape.height / 2;
              const tgtCx = tgt.x + tgtShape.width / 2;
              const tgtCy = tgt.y + tgtShape.height / 2;

              /* 计算连线端点 —— 统一矩形节点碰撞计算 */
              const p1 = getEdgePoint(
                srcCx,
                srcCy,
                srcShape.width / 2,
                srcShape.height / 2,
                tgtCx,
                tgtCy,
              );
              const p2 = getEdgePoint(
                tgtCx,
                tgtCy,
                tgtShape.width / 2,
                tgtShape.height / 2,
                srcCx,
                srcCy,
              );

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
            const nodeType = normalizeNodeType(node.type);
            const isStart = nodeType === 'START';
            const isEnd = nodeType === 'END';
            const isBranch = nodeType === 'TASK_BRANCH';
            const shapeInfo = getNodeShape(nodeType);
            const nodeW = shapeInfo.width;
            const nodeH = shapeInfo.height;
            const assigneeCount = execution?.assignees.length ?? nConfig?.assignees?.length ?? 0;

            /* 构建 CSS 类名 */
            const typeClass = `real-flow-node--type-${nodeType.toLowerCase().replace('_', '-')}`;
            const typeLabel = isStart
              ? '开始'
              : isEnd
              ? '结束'
              : isBranch
              ? '分支任务'
              : '任务';

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
                  /* 子流程按钮需要溢出节点边界，编辑模式下任务节点允许 overflow */
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
                <div className="flow-node-card__head">
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    {nConfig?.priority && (
                      <span
                        title={`优先级: ${nConfig.priority}`}
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: PRIORITY_DOT_COLOR[nConfig.priority] ?? '#94a3b8',
                          marginRight: 6,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {renderStatusIcon(execution?.status)}
                    <Text strong ellipsis style={{ fontSize: 13, maxWidth: isBranch ? 108 : 124 }}>
                      {node.text}
                    </Text>
                  </div>
                  {isBranch && <span className="flow-node-branch-pill">子流程</span>}
                </div>
                <div className="flow-node-card__meta">
                  <Tag className="flow-node-type-tag">{typeLabel}</Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {execution ? STATUS_LABEL[execution.status] : '未生成执行实例'}
                  </Text>
                </div>
                <div className="flow-node-card__footer">
                  {nConfig?.dueDate ? (
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                      截止 {dayjs(nConfig.dueDate).format('MM-DD')}
                    </Text>
                  ) : (
                    <span className="flow-node-card__footer-placeholder">未设置截止时间</span>
                  )}
                  {assigneeCount > 0 && (
                    <span className="flow-node-card__assignees">{assigneeCount} 人</span>
                  )}
                </div>
                {canEdit && selected && (
                  <Text type="secondary" style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>
                    {node.id}
                  </Text>
                )}
                {/* 子流程"+"按钮 —— 仅编辑模式下非 START/END 节点显示 */}
                {canEdit && !isStart && !isEnd && (
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'up', label: '向上添加子流程' },
                        { key: 'down', label: '向下添加子流程' },
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
            const srcShape = getNodeShape(normalizeNodeType(srcNode.type));
            const tgtShape = getNodeShape(normalizeNodeType(tgtNode.type));
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
          initialValues={{ artifacts: [], nodeType: addNodeType }}
        >
          <Form.Item label="节点类型" name="nodeType">
            <Select
              disabled={addNodeType === 'START'}
              options={
                addNodeType === 'START'
                  ? [
                      { label: 'START（起始）', value: 'START' },
                    ]
                  : [
                      { label: 'TASK_SIMPLE（无分支任务）', value: 'TASK_SIMPLE' },
                      { label: 'TASK_BRANCH（有分支任务）', value: 'TASK_BRANCH' },
                    ]
              }
            />
          </Form.Item>
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
            执行配置（建议填写）
          </Divider>
          <Form.Item
            label="负责人 ID"
            name="assignees"
            extra="支持选择多个用户，用于补齐节点执行责任人。"
          >
            <Select
              mode="multiple"
              placeholder="请选择负责人"
              options={availableAssignees.map((id) => ({ value: id, label: id }))}
              notFoundContent={<Text type="secondary" style={{ fontSize: 12 }}>暂无可选人员</Text>}
            />
          </Form.Item>
          <Form.Item label="截止时间" name="dueDate">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="可选，设置节点计划截止时间"
            />
          </Form.Item>
          <Form.Item label="优先级" name="priority">
            <Select
              allowClear
              placeholder="可选，选择节点优先级"
              options={[
                { label: '低', value: 'LOW' },
                { label: '中', value: 'MEDIUM' },
                { label: '高', value: 'HIGH' },
                { label: '紧急', value: 'URGENT' },
              ]}
            />
          </Form.Item>
          <Form.Item label="预估工时（小时）" name="estimatedHours">
            <InputNumber
              min={0}
              precision={1}
              style={{ width: '100%' }}
              placeholder="可选，填写预估投入时间"
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
