import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FlowCanvas from './index';
import type { FlowDefinition, NodeExecution } from '../../api/types';

const flowDefinitionMock: FlowDefinition = {
  id: 'flow-1',
  projectId: 'project-1',
  version: 1,
  publishStatus: 'DRAFT',
  graphJson: {
    nodes: [
      { id: 'start-node', text: '开始', x: 80, y: 80, type: 'START' },
      { id: 'end-node', text: '终止', x: 320, y: 220, type: 'END' },
    ],
    edges: [{ source: 'start-node', target: 'end-node' }],
  },
  nodesConfig: [
    { nodeId: 'start-node', name: '开始', requiredArtifacts: [], type: 'START' },
    { nodeId: 'end-node', name: '终止', requiredArtifacts: [], type: 'END' },
  ],
  updatedAt: '2026-04-17T00:00:00.000Z',
};

const executionsMock: NodeExecution[] = [
  {
    executionId: 'exec-start',
    nodeId: 'start-node',
    nodeName: '开始',
    status: 'COMPLETED',
    assignees: [],
    updatedAt: '2026-04-17T00:00:00.000Z',
  },
  {
    executionId: 'exec-end',
    nodeId: 'end-node',
    nodeName: '终止',
    status: 'READY',
    assignees: [],
    updatedAt: '2026-04-17T00:00:00.000Z',
  },
];

describe('FlowCanvas drag stress regression', () => {
  it('编辑模式下 END 节点连续 mousemove + mouseup 后再 mousemove 不应触发空指针崩溃', () => {
    render(
      <FlowCanvas
        flowDefinition={flowDefinitionMock}
        executions={executionsMock}
        mode="edit"
        onNodeClick={vi.fn()}
      />,
    );

    const endLabel = screen.getByText('终止');
    const endNodeButton = endLabel.closest('[role="button"]');
    expect(endNodeButton).not.toBeNull();
    if (!endNodeButton) {
      return;
    }

    // 压力序列：快速拖拽 END 节点并在 mouseup 后继续触发 mousemove，验证竞态不会读到空 ref。
    expect(() => {
      fireEvent.mouseDown(endNodeButton, { button: 0, clientX: 340, clientY: 240 });
      for (let i = 0; i < 20; i += 1) {
        fireEvent.mouseMove(window, { clientX: 350 + i * 3, clientY: 250 + i * 2 });
      }
      fireEvent.mouseUp(window);
      for (let i = 0; i < 20; i += 1) {
        fireEvent.mouseMove(window, { clientX: 430 + i, clientY: 300 + i });
      }
    }).not.toThrow();

    // 断言组件仍存活，END 节点仍在文档中。
    expect(screen.getByText('终止')).toBeInTheDocument();
  });
});
