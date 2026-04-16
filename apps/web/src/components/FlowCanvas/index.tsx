import { useMemo } from 'react';
import { Typography } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import type { FlowDefinition, NodeExecution } from '../../api/types';
import NodeCard from './NodeCard';

const { Text } = Typography;

interface FlowCanvasProps {
  flowDefinition: FlowDefinition;
  executions: NodeExecution[];
  selectedExecutionId?: string;
  onNodeClick: (execution: NodeExecution) => void;
}

/**
 * 按 graphJson 边关系做拓扑排序，返回有序节点 ID 列表
 * 若存在环则退回原始顺序（防御性处理）
 */
function topoSort(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodeIds.forEach((id) => {
    graph.set(id, []);
    inDegree.set(id, 0);
  });

  edges.forEach(({ source, target }) => {
    if (graph.has(source) && graph.has(target)) {
      graph.get(source)!.push(target);
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  });

  const queue = nodeIds.filter((id) => inDegree.get(id) === 0);
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const next of graph.get(current) ?? []) {
      const deg = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  return result.length === nodeIds.length ? result : nodeIds;
}

/**
 * 流程画布组件（MVP 占位实现）
 *
 * 当前采用"有序节点列表 + 箭头"的可视化方案，
 * 待正式版接入 LogicFlow 渲染真实有向图。
 * 适配层接口：onNodeClick / executions / flowDefinition 保持不变，
 * 后续替换实现体时上层页面无需修改。
 */
export default function FlowCanvas({
  flowDefinition,
  executions,
  selectedExecutionId,
  onNodeClick,
}: FlowCanvasProps) {
  const { graphJson, nodesConfig } = flowDefinition;
  const nodes = graphJson.nodes ?? [];
  const edges = graphJson.edges ?? [];

  // 按边关系做拓扑排序
  const sortedNodeIds = useMemo(
    () => topoSort(nodes.map((n) => n.id), edges),
    [nodes, edges],
  );

  // 构建 nodeId → execution 映射
  const execMap = useMemo(() => {
    const map = new Map<string, NodeExecution>();
    executions.forEach((e) => map.set(e.nodeId, e));
    return map;
  }, [executions]);

  // 构建 nodeId → nodeConfig 映射
  const configMap = useMemo(
    () => new Map(nodesConfig.map((nc) => [nc.nodeId, nc])),
    [nodesConfig],
  );

  if (sortedNodeIds.length === 0) {
    return (
      <Text type="secondary" style={{ display: 'block', padding: '24px 0' }}>
        流程尚未配置节点，请先保存流程草稿。
      </Text>
    );
  }

  return (
    <div>
      {/* 说明文字 */}
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 12, display: 'block' }}>
        点击节点卡片查看详情并执行操作；箭头表示流转顺序。
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 8, color: '#bfbfbf' }}>
          （MVP 占位画布，后续接入 LogicFlow 可拖拽编辑）
        </Text>
      </Text>

      {/* 节点列表 + 箭头，支持横向滚动 */}
      <div className="flow-canvas-scroll">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            flexWrap: 'nowrap',
            padding: '8px 4px',
            minWidth: 'max-content',
          }}
        >
          {sortedNodeIds.map((nodeId, idx) => {
            const execution = execMap.get(nodeId);
            const nodeConfig = configMap.get(nodeId);

            if (!execution) return null;

            return (
              <div key={nodeId} style={{ display: 'flex', alignItems: 'center' }}>
                <NodeCard
                  execution={execution}
                  nodeConfig={nodeConfig}
                  highlighted={
                    execution.executionId === selectedExecutionId ||
                    execution.status === 'NEEDS_FIX'
                  }
                  onClick={() => onNodeClick(execution)}
                />
                {/* 节点之间的连接箭头 */}
                {idx < sortedNodeIds.length - 1 && (
                  <span className="flow-arrow">
                    <RightOutlined />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
