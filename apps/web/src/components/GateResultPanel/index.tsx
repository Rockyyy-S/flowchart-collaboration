import { Alert, List, Tag, Typography } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { GateResult } from '../../api/types';

const { Text } = Typography;

interface GateResultPanelProps {
  gateResult: GateResult | null;
  /** 处于加载/检查中状态 */
  checking?: boolean;
}

/**
 * 门禁结果面板 —— 增强视觉区分
 *
 * 通过/失败/检查中三种状态使用不同渐变背景和图标，视觉差异更大。
 */
export default function GateResultPanel({ gateResult, checking }: GateResultPanelProps) {
  if (checking) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<LoadingOutlined spin />}
        message={<Text strong>门禁检查中…</Text>}
        description="系统正在校验必需输出物，请稍候。"
        className="gate-result-checking"
        style={{ marginTop: 12 }}
      />
    );
  }

  if (!gateResult) return null;

  if (gateResult.pass) {
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined style={{ fontSize: 20 }} />}
        message={<Text strong style={{ color: 'var(--color-success)' }}>门禁通过</Text>}
        description="所有必需输出物均已绑定，节点已完成。"
        className="gate-result-pass"
        style={{ marginTop: 12 }}
      />
    );
  }

  return (
    <Alert
      type="error"
      showIcon
      icon={<ExclamationCircleOutlined style={{ fontSize: 20 }} />}
      message={<Text strong style={{ color: 'var(--color-error)' }}>门禁未通过 — 缺少以下必需文档</Text>}
      description={
        <List
          size="small"
          dataSource={gateResult.missingArtifacts}
          renderItem={(item) => (
            <List.Item style={{ padding: '6px 0' }}>
              <Tag color="error" style={{ marginRight: 8, borderRadius: 6 }}>
                缺失
              </Tag>
              <Text strong>{item.name}</Text>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                ({item.requirementId})
              </Text>
            </List.Item>
          )}
        />
      }
      className="gate-result-fail"
      style={{ marginTop: 12 }}
    />
  );
}
