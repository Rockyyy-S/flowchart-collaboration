import { Alert, List, Tag, Typography } from 'antd';
import { ExclamationCircleFilled, CheckCircleFilled } from '@ant-design/icons';
import type { GateResult } from '../../api/types';

const { Text } = Typography;

interface GateResultPanelProps {
  gateResult: GateResult | null;
  /** 处于加载/检查中状态 */
  checking?: boolean;
}

/**
 * 门禁结果面板
 *
 * 展示最近一次门禁检查的通过/失败结果及缺失输出物明细。
 * 放置于 NodeDetailDrawer 内，紧跟提交操作之后。
 */
export default function GateResultPanel({ gateResult, checking }: GateResultPanelProps) {
  if (checking) {
    return (
      <Alert
        type="info"
        showIcon
        message="门禁检查中…"
        description="系统正在校验必需输出物，请稍候。"
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
        icon={<CheckCircleFilled />}
        message="门禁通过"
        description="所有必需输出物均已绑定，节点已完成。"
        style={{ marginTop: 12 }}
      />
    );
  }

  return (
    <Alert
      type="error"
      showIcon
      icon={<ExclamationCircleFilled />}
      message="门禁未通过 — 缺少以下必需文档"
      description={
        <List
          size="small"
          dataSource={gateResult.missingArtifacts}
          renderItem={(item) => (
            <List.Item style={{ padding: '4px 0' }}>
              <Tag color="error" style={{ marginRight: 6 }}>
                缺失
              </Tag>
              <Text>{item.name}</Text>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                (requirementId: {item.requirementId})
              </Text>
            </List.Item>
          )}
        />
      }
      style={{ marginTop: 12 }}
    />
  );
}
