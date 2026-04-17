import { useState } from 'react';
import {
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
  ExclamationCircleOutlined,
  FileAddOutlined,
  PlayCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  startExecution,
  submitExecution,
  getGateResult,
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

/** 状态标签颜色配置 —— 升级配色 */
const STATUS_TAG: Record<ExecutionStatus, { color: string; label: string }> = {
  PENDING: { color: 'default', label: '待启动' },
  READY: { color: 'purple', label: '可开始' },
  IN_PROGRESS: { color: 'orange', label: '进行中' },
  GATE_CHECKING: { color: 'geekblue', label: '门禁检查中' },
  COMPLETED: { color: 'success', label: '已完成' },
  NEEDS_FIX: { color: 'error', label: '待补齐' },
};

interface NodeDetailPanelProps {
  projectId: string;
  execution: NodeExecution | null;
  nodeConfig?: NodeConfig;
  onClose: () => void;
}

/**
 * 右侧节点详情面板
 *
 * 从 NodeDetailDrawer 改造而来，由 Drawer 改为固定面板，嵌入三栏布局右侧。
 * 保持原有全部功能：节点信息、开始执行、提交、门禁结果、文档绑定。
 */
export default function NodeDetailPanel({
  projectId,
  execution,
  nodeConfig,
  onClose,
}: NodeDetailPanelProps) {
  const queryClient = useQueryClient();
  const [submitComment, setSubmitComment] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [localGateResult, setLocalGateResult] = useState<{
    pass: boolean;
    checkedAt: string;
    missingArtifacts: Array<{ requirementId: string; name: string }>;
  } | null>(null);

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

  /* 开始执行 */
  const startMut = useMutation({
    mutationFn: () => startExecution(executionId!),
    onSuccess: () => {
      message.success('节点已开始执行');
      setLocalGateResult(null);
      invalidateExecutions();
    },
  });

  /* 提交 */
  const submitMut = useMutation({
    mutationFn: () => submitExecution(executionId!, submitComment),
    onSuccess: (result) => {
      if (result.gatePass) {
        message.success('提交成功，门禁通过——节点已完成！');
      } else {
        message.warning(
          `门禁未通过，${result.missingArtifacts.length} 份文档待补齐`,
        );
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

  if (!execution) return null;

  const statusCfg = STATUS_TAG[execution.status];
  const requiredArtifacts = nodeConfig?.requiredArtifacts ?? [];
  const missingIds = new Set(
    gateResult?.missingArtifacts.map((m) => m.requirementId) ?? [],
  );
  const canStart =
    execution.status === 'READY' || execution.status === 'NEEDS_FIX';
  const canSubmit = execution.status === 'IN_PROGRESS';

  return (
    <>
      <div className="node-detail-panel">
        {/* 面板标题 —— 渐变背景 */}
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

        {/* 面板内容 —— 可滚动 */}
        <div className="node-detail-panel__body">
          {/* 基本信息 */}
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="节点 ID">
              <Text code style={{ fontSize: 12 }}>
                {execution.nodeId}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="执行 ID">
              <Text code style={{ fontSize: 12 }}>
                {execution.executionId}
              </Text>
            </Descriptions.Item>
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
          </Descriptions>

          {/* 输出物要求 */}
          {requiredArtifacts.length > 0 && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0', fontWeight: 600 }}>
                输出物要求
              </Divider>
              <List
                size="small"
                dataSource={requiredArtifacts}
                renderItem={(artifact) => {
                  const isMissing = missingIds.has(artifact.id);
                  return (
                    <List.Item
                      className={isMissing ? 'artifact-item-missing' : (execution.status === 'COMPLETED' ? 'artifact-item-bound' : '')}
                      style={{
                        padding: '8px 12px',
                        marginBottom: 6,
                        borderRadius: 'var(--radius-md)',
                      }}
                      actions={[
                        isMissing ? (
                          <Button
                            key="upload"
                            size="small"
                            type="primary"
                            danger
                            icon={<FileAddOutlined />}
                            onClick={() => setUploadOpen(true)}
                          >
                            补齐
                          </Button>
                        ) : execution.status !== 'COMPLETED' &&
                          execution.status !== 'PENDING' ? (
                          <Button
                            key="upload"
                            size="small"
                            icon={<FileAddOutlined />}
                            onClick={() => setUploadOpen(true)}
                          >
                            绑定
                          </Button>
                        ) : null,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          isMissing ? (
                            <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginTop: 2 }} />
                          ) : (
                            <CheckCircleOutlined
                              style={{
                                color: '#52c41a',
                                marginTop: 2,
                                opacity:
                                  execution.status === 'COMPLETED' ||
                                  !artifact.required
                                    ? 1
                                    : 0.3,
                              }}
                            />
                          )
                        }
                        title={
                          <Text style={{ fontSize: 13 }}>
                            {artifact.name}
                            {artifact.required && (
                              <Badge
                                count="必需"
                                style={{
                                  backgroundColor: '#ff4d4f',
                                  marginLeft: 6,
                                  fontSize: 10,
                                }}
                              />
                            )}
                          </Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </>
          )}

          {/* 门禁结果 */}
          <GateResultPanel
            gateResult={gateResult}
            checking={submitMut.isPending}
          />

          <Divider style={{ margin: '16px 0' }} />

          {/* 操作区 —— 统一按钮样式 */}
          <div className="action-btn-group">
            {canStart && (
              <div style={{ marginBottom: 12 }}>
                {execution.status === 'NEEDS_FIX' && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8, lineHeight: 1.6 }}>
                    已补齐文档后，请点击「重新开始」将节点恢复为进行中，再提交。
                  </Text>
                )}
                <Button
                  type="primary"
                  block
                  icon={<PlayCircleOutlined />}
                  loading={startMut.isPending}
                  onClick={() => startMut.mutate()}
                >
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
                  rows={2}
                  maxLength={200}
                  showCount
                  style={{ marginBottom: 8, borderRadius: 'var(--radius-md)' }}
                />
                <Button
                  type="primary"
                  block
                  icon={<SendOutlined />}
                  loading={submitMut.isPending}
                  onClick={() => submitMut.mutate()}
                >
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

          {execution.status === 'PENDING' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 8 }}>⏳</div>
              <Text type="secondary" style={{ display: 'block' }}>
                等待前置节点完成后自动解锁…
              </Text>
            </div>
          )}

          {/* 上传文档快捷入口 */}
          {execution.status !== 'COMPLETED' &&
            execution.status !== 'PENDING' &&
            requiredArtifacts.length > 0 && (
              <>
                <Divider style={{ margin: '14px 0' }} />
                <Button
                  block
                  icon={<FileAddOutlined />}
                  onClick={() => setUploadOpen(true)}
                  style={{ borderRadius: 'var(--radius-md)' }}
                >
                  上传 / 绑定文档
                </Button>
              </>
            )}
          </div> {/* 关闭 action-btn-group */}
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
