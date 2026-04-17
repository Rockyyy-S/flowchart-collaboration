import { useState } from 'react';
import {
  Badge,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Input,
  List,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
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

/** 优先级标签配色：LOW=灰 / MEDIUM=蓝 / HIGH=橙 / URGENT=红 */
const PRIORITY_TAG: Record<string, { color: string; label: string }> = {
  LOW: { color: 'default', label: '低' },
  MEDIUM: { color: 'blue', label: '中' },
  HIGH: { color: 'orange', label: '高' },
  URGENT: { color: 'red', label: '紧急' },
};

/** 状态标签颜色配置 */
const STATUS_TAG: Record<ExecutionStatus, { color: string; label: string }> = {
  PENDING: { color: 'default', label: '待启动' },
  READY: { color: 'blue', label: '可开始' },
  IN_PROGRESS: { color: 'orange', label: '进行中' },
  GATE_CHECKING: { color: 'purple', label: '门禁检查中' },
  COMPLETED: { color: 'success', label: '已完成' },
  NEEDS_FIX: { color: 'error', label: '待补齐' },
};

interface NodeDetailDrawerProps {
  projectId: string;
  execution: NodeExecution | null;
  nodeConfig?: NodeConfig;
  open: boolean;
  onClose: () => void;
}

/**
 * 节点详情抽屉
 *
 * 功能：
 * 1. 展示节点基本信息与状态
 * 2. 开始执行（READY → IN_PROGRESS）
 * 3. 提交完成（IN_PROGRESS → GATE_CHECKING → COMPLETED / NEEDS_FIX）
 * 4. 显示门禁结果（通过 / 失败 + 缺失文档列表）
 * 5. 上传文档并绑定（NEEDS_FIX 时高亮缺失项）
 * 6. 补齐后重试 Submit
 */
export default function NodeDetailDrawer({
  projectId,
  execution,
  nodeConfig,
  open,
  onClose,
}: NodeDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [submitComment, setSubmitComment] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [localGateResult, setLocalGateResult] = useState<{
    pass: boolean;
    checkedAt: string;
    missingArtifacts: Array<{ requirementId: string; name: string }>;
  } | null>(null);

  const executionId = execution?.executionId;

  // 拉取门禁结果（仅在已有历史结果时显示，通过 submit 响应即时更新）
  const { data: serverGateResult } = useQuery({
    queryKey: ['gate-result', executionId],
    queryFn: () => getGateResult(executionId!),
    enabled:
      !!executionId &&
      (execution?.status === 'NEEDS_FIX' || execution?.status === 'COMPLETED'),
    staleTime: 5000,
  });

  // 使用 localGateResult 优先（submit 后立即有数据），否则 fallback 到服务端
  const gateResult = localGateResult ?? serverGateResult ?? null;

  // 拉取项目文档列表（用于复用已有文档）
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => getDocuments(projectId),
    enabled: !!projectId && open,
    staleTime: 10000,
  });

  /** 刷新执行列表 */
  function invalidateExecutions() {
    queryClient.invalidateQueries({ queryKey: ['executions', projectId] });
    queryClient.invalidateQueries({ queryKey: ['gate-result', executionId] });
  }

  // 开始执行
  const startMut = useMutation({
    mutationFn: () => startExecution(executionId!),
    onSuccess: () => {
      message.success('节点已开始执行');
      setLocalGateResult(null);
      invalidateExecutions();
    },
  });

  // 提交
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

  // 缺失的输出物（门禁失败时用于高亮和过滤）
  const missingIds = new Set(
    gateResult?.missingArtifacts.map((m) => m.requirementId) ?? [],
  );

  const canStart =
    execution.status === 'READY' || execution.status === 'NEEDS_FIX';
  const canSubmit = execution.status === 'IN_PROGRESS';

  return (
    <>
      <Drawer
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              {execution.nodeName}
            </Title>
            <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          </Space>
        }
        placement="right"
        width={Math.min(480, window.innerWidth)}
        open={open}
        onClose={() => {
          setLocalGateResult(null);
          onClose();
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* ── 基本信息 ── */}
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

        {/* ── 节点配置扩展信息（描述 / 优先级 / 执行人 / 截止时间 / 预估工时） ── */}
        {nodeConfig?.description && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>描述</Text>
            <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6 }}>
              {nodeConfig.description}
            </div>
          </div>
        )}
        {nodeConfig?.priority && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>优先级</Text>
            <Tag color={PRIORITY_TAG[nodeConfig.priority]?.color ?? 'default'}>
              {PRIORITY_TAG[nodeConfig.priority]?.label ?? nodeConfig.priority}
            </Tag>
          </div>
        )}
        {nodeConfig?.assignees && nodeConfig.assignees.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>执行人</Text>
            <div style={{ marginTop: 4 }}>
              {nodeConfig.assignees.map((uid) => (
                <Tag key={uid} style={{ marginBottom: 4 }}>{uid}</Tag>
              ))}
            </div>
          </div>
        )}
        {nodeConfig?.dueDate && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>截止时间</Text>
            <Text>{dayjs(nodeConfig.dueDate).format('YYYY-MM-DD HH:mm')}</Text>
          </div>
        )}
        {nodeConfig?.estimatedHours != null && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>预估工时</Text>
            <Text>{nodeConfig.estimatedHours} 小时</Text>
          </div>
        )}

        {/* ── 输出物要求 ── */}
        {requiredArtifacts.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0' }}>
              输出物要求
            </Divider>
            <List
              size="small"
              dataSource={requiredArtifacts}
              renderItem={(artifact) => {
                const isMissing = missingIds.has(artifact.id);
                return (
                  <List.Item
                    style={{
                      background: isMissing ? '#fff2f0' : undefined,
                      borderRadius: 6,
                      padding: '6px 10px',
                      marginBottom: 4,
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

        {/* ── 门禁结果 ── */}
        <GateResultPanel
          gateResult={gateResult}
          checking={submitMut.isPending}
        />

        <Divider style={{ margin: '16px 0' }} />

        {/* ── 操作区 ── */}

        {/* 开始执行按钮（READY 或 NEEDS_FIX 补齐后重试）  */}
        {canStart && (
          <div style={{ marginBottom: 12 }}>
            {execution.status === 'NEEDS_FIX' && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
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

        {/* 提交按钮（IN_PROGRESS 时可提交） */}
        {canSubmit && (
          <div>
            <Input.TextArea
              placeholder="提交备注（可选）"
              value={submitComment}
              onChange={(e) => setSubmitComment(e.target.value)}
              rows={2}
              maxLength={200}
              showCount
              style={{ marginBottom: 8 }}
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

        {/* 已完成：显示成功状态 */}
        {execution.status === 'COMPLETED' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Spin spinning={false}>
              <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
              <br />
              <Text type="success" style={{ marginTop: 8, display: 'block' }}>
                节点已完成，门禁验证通过
              </Text>
            </Spin>
          </div>
        )}

        {/* PENDING 状态：无操作 */}
        {execution.status === 'PENDING' && (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
            等待前置节点完成后自动解锁……
          </Text>
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
              >
                上传 / 绑定文档
              </Button>
            </>
          )}
      </Drawer>

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
