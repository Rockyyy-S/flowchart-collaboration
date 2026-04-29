/**
 * 右侧节点详情面板（重构为三分区）
 *
 * 第一分区：节点基本信息（名称、状态、负责人、截止时间等）
 * 第二分区：审核上一节点产物（仅当上一节点存在且为 IN_PROGRESS/COMPLETED 时显示）
 * 第三分区：上传当前节点产物 + 完成按钮
 */
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Descriptions,
  Divider,
  Input,
  List,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseOutlined,
  DislikeOutlined,
  ExclamationCircleOutlined,
  FileAddOutlined,
  LikeOutlined,
  PlayCircleOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  startExecution,
  submitExecution,
  getGateResult,
  approveExecution,
  rejectExecution,
} from '../../api/executions';
import { getDocuments } from '../../api/documents';
import GateResultPanel from '../GateResultPanel';
import DocumentUploadModal from '../DocumentUploadModal';
import type {
  NodeExecution,
  NodeConfig,
  ExecutionStatus,
} from '../../api/types';

const { Text, Title } = Typography;

/** 状态标签颜色配置（含新增的 REJECTED） */
const STATUS_TAG: Record<ExecutionStatus, { color: string; label: string }> = {
  PENDING: { color: 'default', label: '待启动' },
  READY: { color: 'purple', label: '可开始' },
  IN_PROGRESS: { color: 'orange', label: '进行中' },
  GATE_CHECKING: { color: 'geekblue', label: '门禁检查中' },
  COMPLETED: { color: 'success', label: '已完成' },
  NEEDS_FIX: { color: 'error', label: '待补齐' },
  REJECTED: { color: 'red', label: '被回退' },
};

interface NodeDetailPanelProps {
  projectId: string;
  /** 当前节点执行实例 */
  execution: NodeExecution | null;
  /** 当前节点配置（含 predecessorNodeIds、assignees 等） */
  nodeConfig?: NodeConfig;
  /** 项目下所有节点执行列表（用于查找上一节点） */
  allExecutions: NodeExecution[];
  /** 当前登录用户 ID */
  currentUserId?: string;
  onClose: () => void;
}

/**
 * 右侧节点详情面板（三分区版）
 *
 * 第一分区：节点基本信息
 * 第二分区：审核上一节点产物（仅对参与者且上一节点可审核时显示）
 * 第三分区：上传当前节点产物 + 完成按钮
 */
export default function NodeDetailPanel({
  projectId,
  execution,
  nodeConfig,
  allExecutions,
  currentUserId,
  onClose,
}: NodeDetailPanelProps) {
  const queryClient = useQueryClient();
  const [submitComment, setSubmitComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [localGateResult, setLocalGateResult] = useState<{
    pass: boolean;
    checkedAt: string;
    missingArtifacts: Array<{ requirementId: string; name: string }>;
  } | null>(null);

  // 抑制未使用的 currentUserId 警告（保留备用）
  void currentUserId;

  const executionId = execution?.executionId;

  /* 拉取门禁结果 */
  const { data: serverGateResult } = useQuery({
    queryKey: ['gate-result', executionId],
    queryFn: () => getGateResult(executionId!),
    enabled:
      !!executionId &&
      (execution?.status === 'NEEDS_FIX' || execution?.status === 'COMPLETED'),
    staleTime: 5000,
  });

  const gateResult = localGateResult ?? serverGateResult ?? null;

  /* 拉取项目文档列表 */
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => getDocuments(projectId),
    enabled: !!projectId && !!execution,
    staleTime: 10000,
  });

  /** 刷新执行列表 */
  function invalidateExecutions() {
    queryClient.invalidateQueries({ queryKey: ['executions', projectId] });
    queryClient.invalidateQueries({ queryKey: ['gate-result', executionId] });
  }

  /* 开始执行 mutation */
  const startMut = useMutation({
    mutationFn: () => startExecution(executionId!),
    onSuccess: () => {
      message.success('节点已开始执行');
      setLocalGateResult(null);
      invalidateExecutions();
    },
  });

  /* 提交完成 mutation */
  const submitMut = useMutation({
    mutationFn: () => submitExecution(executionId!, submitComment),
    onSuccess: (result) => {
      if (result.gatePass) {
        message.success('提交成功，门禁通过——节点已完成！');
      } else {
        message.warning(`门禁未通过，${result.missingArtifacts.length} 份文档待补齐`);
      }
      setLocalGateResult({
        pass: result.gatePass,
        checkedAt: new Date().toISOString(),
        missingArtifacts: result.missingArtifacts,
      });
      setSubmitComment('');
      invalidateExecutions();
    },
  });

  /* 审核通过 mutation */
  const approveMut = useMutation({
    mutationFn: ({ prevNodeId, nextNodeId }: { prevNodeId: string; nextNodeId: string }) =>
      approveExecution(projectId, prevNodeId, nextNodeId),
    onSuccess: () => {
      message.success('已通过审核，流程推进至下一节点');
      invalidateExecutions();
    },
  });

  /* 审核拒绝 mutation */
  const rejectMut = useMutation({
    mutationFn: ({ prevNodeId, nextNodeId, reason }: { prevNodeId: string; nextNodeId: string; reason: string }) =>
      rejectExecution(projectId, prevNodeId, nextNodeId, reason),
    onSuccess: () => {
      message.warning('已拒绝，流程回退到上一节点');
      setRejectReason('');
      invalidateExecutions();
    },
  });

  if (!execution) return null;

  const statusCfg = STATUS_TAG[execution.status] ?? STATUS_TAG.PENDING;
  const requiredArtifacts = nodeConfig?.requiredArtifacts ?? [];
  const missingIds = new Set(gateResult?.missingArtifacts.map((m) => m.requirementId) ?? []);
  const canStart = execution.status === 'READY' || execution.status === 'NEEDS_FIX';
  const canSubmit = execution.status === 'IN_PROGRESS';

  /* 查找上一节点执行实例 */
  const predecessorNodeIds = nodeConfig?.predecessorNodeIds ?? [];
  const prevExecution = allExecutions.find((e) => predecessorNodeIds.includes(e.nodeId)) ?? null;
  const prevNodeReviewable =
    prevExecution !== null &&
    (prevExecution.status === 'IN_PROGRESS' || prevExecution.status === 'COMPLETED');

  return (
    <>
      <div className="node-detail-panel">
        {/* 面板标题 */}
        <div className="node-detail-panel__header">
          <Space>
            <Title level={5} style={{ margin: 0, fontSize: 15 }}>
              {execution.nodeName}
            </Title>
            <Tag color={statusCfg.color} style={{ borderRadius: 6, fontWeight: 500 }}>{statusCfg.label}</Tag>
          </Space>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => {
              setLocalGateResult(null);
              onClose();
            }}
            style={{ borderRadius: 'var(--radius-sm)' }}
          />
        </div>

        {/* 面板内容 */}
        <div className="node-detail-panel__body">
          {/* ─── 第一分区：节点基本信息 ─── */}
          <Divider orientation="left" style={{ fontSize: 13, margin: '0 0 12px 0', fontWeight: 600 }}>
            节点信息
          </Divider>
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="节点 ID">
              <Text code style={{ fontSize: 12 }}>{execution.nodeId}</Text>
            </Descriptions.Item>
            {nodeConfig?.description && (
              <Descriptions.Item label="描述">
                <Text style={{ fontSize: 12 }}>{nodeConfig.description}</Text>
              </Descriptions.Item>
            )}
            {execution.assignees.length > 0 && (
              <Descriptions.Item label="负责人">
                <Space size={4} wrap>
                  {execution.assignees.map((uid) => (
                    <Tag key={uid} style={{ fontSize: 11 }}>{uid}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            {execution.dueAt && (
              <Descriptions.Item label="截止时间">
                <Text style={{ fontSize: 12 }}>{dayjs(execution.dueAt).format('YYYY-MM-DD HH:mm')}</Text>
              </Descriptions.Item>
            )}
            {execution.startedAt && (
              <Descriptions.Item label="开始时间">
                {dayjs(execution.startedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            {execution.completedAt && (
              <Descriptions.Item label="完成时间">
                {dayjs(execution.completedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            {execution.status === 'REJECTED' && execution.rejectionReason && (
              <Descriptions.Item label="回退理由">
                <Text type="danger" style={{ fontSize: 12 }}>{execution.rejectionReason}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* ─── 第二分区：审核上一节点产物 ─── */}
          {prevNodeReviewable && prevExecution && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0', fontWeight: 600, color: 'var(--color-info)' }}>
                审核上一节点产物
              </Divider>
              <div style={{ background: 'var(--color-primary-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  节点：<Tag style={{ fontSize: 11 }}>{prevExecution.nodeName}</Tag>
                  状态：<Tag color={STATUS_TAG[prevExecution.status]?.color}>{STATUS_TAG[prevExecution.status]?.label}</Tag>
                </Text>
                {(prevExecution.artifacts ?? []).length > 0 ? (
                  <List
                    size="small"
                    dataSource={prevExecution.artifacts}
                    renderItem={(art) => (
                      <List.Item key={art.bindingId} style={{ padding: '4px 0' }}>
                        <Space size={6}>
                          <CheckCircleOutlined style={{ color: 'var(--color-success)', fontSize: 12 }} />
                          <Text style={{ fontSize: 12 }}>
                            requirementId: {art.requirementId}
                            {art.documentId && <> | docId: {art.documentId}</>}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>上一节点暂无产出物记录</Text>
                )}
                <Divider style={{ margin: '10px 0' }} />
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary" icon={<LikeOutlined />} block
                    loading={approveMut.isPending}
                    onClick={() => approveMut.mutate({ prevNodeId: prevExecution.nodeId, nextNodeId: execution.nodeId })}
                  >
                    通过（推进流程）
                  </Button>
                  <Input.TextArea
                    placeholder="拒绝理由（必填，拒绝后流程回退到上一节点）"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2} maxLength={200} showCount
                    style={{ borderRadius: 'var(--radius-md)' }}
                  />
                  <Button
                    danger icon={<DislikeOutlined />} block
                    loading={rejectMut.isPending}
                    disabled={!rejectReason.trim()}
                    onClick={() => {
                      if (!rejectReason.trim()) { message.error('拒绝理由不能为空'); return; }
                      rejectMut.mutate({ prevNodeId: prevExecution.nodeId, nextNodeId: execution.nodeId, reason: rejectReason.trim() });
                    }}
                  >
                    拒绝（回退到上一节点）
                  </Button>
                </Space>
              </div>
            </>
          )}

          {/* ─── 第三分区：上传当前节点产物 + 完成 ─── */}
          <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0', fontWeight: 600 }}>
            当前节点操作
          </Divider>

          {/* 输出物要求 */}
          {requiredArtifacts.length > 0 && (
            <List
              size="small"
              dataSource={requiredArtifacts}
              style={{ marginBottom: 12 }}
              renderItem={(artifact) => {
                const isMissing = missingIds.has(artifact.id);
                return (
                  <List.Item
                    className={isMissing ? 'artifact-item-missing' : (execution.status === 'COMPLETED' ? 'artifact-item-bound' : '')}
                    style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 'var(--radius-md)' }}
                    actions={[
                      isMissing ? (
                        <Button key="upload" size="small" type="primary" danger
                          icon={<FileAddOutlined />} onClick={() => setUploadOpen(true)}>
                          补齐
                        </Button>
                      ) : execution.status !== 'COMPLETED' && execution.status !== 'PENDING' ? (
                        <Button key="upload" size="small" icon={<FileAddOutlined />} onClick={() => setUploadOpen(true)}>
                          绑定
                        </Button>
                      ) : null,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        isMissing
                          ? <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginTop: 2 }} />
                          : <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2, opacity: execution.status === 'COMPLETED' || !artifact.required ? 1 : 0.3 }} />
                      }
                      title={
                        <Text style={{ fontSize: 13 }}>
                          {artifact.name}
                          {artifact.required && (
                            <Badge count="必需" style={{ backgroundColor: '#ff4d4f', marginLeft: 6, fontSize: 10 }} />
                          )}
                        </Text>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}

          {/* 门禁结果 */}
          <GateResultPanel gateResult={gateResult} checking={submitMut.isPending} />

          <Divider style={{ margin: '16px 0' }} />

          {/* 操作按钮区 */}
          <div className="action-btn-group">
            {canStart && (
              <div style={{ marginBottom: 12 }}>
                {execution.status === 'NEEDS_FIX' && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8, lineHeight: 1.6 }}>
                    已补齐文档后，请点击「重新开始」将节点恢复为进行中，再提交。
                  </Text>
                )}
                <Button type="primary" block icon={<PlayCircleOutlined />}
                  loading={startMut.isPending} onClick={() => startMut.mutate()}>
                  {execution.status === 'NEEDS_FIX' ? '重新开始（补齐后重试）' : '开始执行'}
                </Button>
              </div>
            )}

            {canSubmit && (
              <div>
                <Input.TextArea
                  placeholder="提交备注（可选）"
                  value={submitComment}
                  onChange={(e) => setSubmitComment(e.target.value)}
                  rows={2} maxLength={200} showCount
                  style={{ marginBottom: 8, borderRadius: 'var(--radius-md)' }}
                />
                <Button type="primary" block icon={<SendOutlined />}
                  loading={submitMut.isPending} onClick={() => submitMut.mutate()}>
                  提交完成（触发门禁检查）
                </Button>
              </div>
            )}

            {execution.status === 'COMPLETED' && (
              <div className="completed-celebration" style={{ textAlign: 'center', padding: '12px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 40, color: 'var(--color-success)' }} />
                <br />
                <Text type="success" style={{ marginTop: 8, display: 'block', fontWeight: 600, fontSize: 14 }}>
                  节点已完成，门禁验证通过
                </Text>
              </div>
            )}

            {execution.status === 'REJECTED' && (
              <Alert
                type="error" showIcon icon={<StopOutlined />}
                message="节点已被下一节点参与者回退"
                description={execution.rejectionReason ?? '请修改后重新提交'}
                style={{ borderRadius: 'var(--radius-md)' }}
              />
            )}

            {execution.status === 'PENDING' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 8 }}>⏳</div>
                <Text type="secondary" style={{ display: 'block' }}>
                  等待前置节点完成后自动解锁…
                </Text>
              </div>
            )}

            {/* 上传文档快捷入口 */}
            {execution.status !== 'COMPLETED' && execution.status !== 'PENDING' && requiredArtifacts.length > 0 && (
              <>
                <Divider style={{ margin: '14px 0' }} />
                <Button block icon={<FileAddOutlined />} onClick={() => setUploadOpen(true)}
                  style={{ borderRadius: 'var(--radius-md)' }}>
                  上传 / 绑定文档
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 文档上传弹窗 */}
      <DocumentUploadModal
        open={uploadOpen}
        projectId={projectId}
        executionId={executionId!}
        requirements={requiredArtifacts}
        existingDocuments={documents}
        onSuccess={() => {
          setUploadOpen(false);
          invalidateExecutions();
          queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
        }}
        onCancel={() => setUploadOpen(false)}
      />
    </>
  );
}
