import { useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import { UploadOutlined, LinkOutlined } from '@ant-design/icons';
import { createDocument } from '../../api/documents';
import { bindArtifact } from '../../api/executions';
import type { ArtifactRequirement, DocumentMeta } from '../../api/types';

const { Text } = Typography;

interface DocumentUploadModalProps {
  open: boolean;
  projectId: string;
  executionId: string;
  /** 待绑定的必需输出物（NEEDS_FIX 时仅缺失项，可全量传入） */
  requirements: ArtifactRequirement[];
  /** 项目内已存在的文档（方便复用） */
  existingDocuments?: DocumentMeta[];
  onSuccess: () => void;
  onCancel: () => void;
}

const MIME_OPTIONS = [
  { label: 'PDF 文档', value: 'application/pdf' },
  { label: 'Word 文档', value: 'application/msword' },
  { label: 'Excel 表格', value: 'application/vnd.ms-excel' },
  { label: 'Markdown', value: 'text/markdown' },
  { label: '图片 (PNG)', value: 'image/png' },
  { label: '其他', value: 'application/octet-stream' },
];

/**
 * 文档上传与输出物绑定弹窗
 *
 * MVP 阶段：无真实文件传输，仅提交文档元数据模拟上传。
 * 后续接入 MinIO/OSS 时替换为 multipart 表单，组件接口不变。
 *
 * 流程：填写文档元数据 → POST /documents → POST /artifacts/bind
 */
export default function DocumentUploadModal({
  open,
  projectId,
  executionId,
  requirements,
  existingDocuments = [],
  onSuccess,
  onCancel,
}: DocumentUploadModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [useExisting, setUseExisting] = useState(false);

  async function handleSubmit() {
    try {
      const values = await form.validateFields();
      setLoading(true);

      let documentId: string;

      if (useExisting && values.existingDocumentId) {
        // 使用已有文档
        documentId = values.existingDocumentId;
      } else {
        // 模拟上传：提交元数据
        const doc = await createDocument(projectId, {
          name: values.name,
          mimeType: values.mimeType,
          size: values.size ? Number(values.size) * 1024 : 102400,
        });
        documentId = doc.documentId;
      }

      // 绑定到选定的输出物
      await bindArtifact(executionId, values.requirementId, documentId);

      message.success('文档已上传并绑定成功');
      form.resetFields();
      onSuccess();
    } catch {
      // 错误由 apiClient 拦截器统一 toast
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="上传并绑定文档"
      open={open}
      onCancel={() => {
        form.resetFields();
        setUseExisting(false);
        onCancel();
      }}
      onOk={handleSubmit}
      okText="确认绑定"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnClose
      width={480}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 12 }}
        initialValues={{ mimeType: 'application/pdf', size: 200 }}
      >
        {/* 选择要绑定的输出物 */}
        <Form.Item
          label="绑定到输出物"
          name="requirementId"
          rules={[{ required: true, message: '请选择要绑定的输出物' }]}
        >
          <Select placeholder="选择输出物要求">
            {requirements.map((r) => (
              <Select.Option key={r.id} value={r.id}>
                {r.name}
                {r.required && (
                  <Text type="danger" style={{ fontSize: 11, marginLeft: 4 }}>
                    必需
                  </Text>
                )}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* 切换：复用已有文档 / 上传新文档 */}
        {existingDocuments.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Space>
              <Button
                size="small"
                type={!useExisting ? 'primary' : 'default'}
                icon={<UploadOutlined />}
                onClick={() => setUseExisting(false)}
              >
                上传新文档
              </Button>
              <Button
                size="small"
                type={useExisting ? 'primary' : 'default'}
                icon={<LinkOutlined />}
                onClick={() => setUseExisting(true)}
              >
                绑定已有文档
              </Button>
            </Space>
          </div>
        )}

        {useExisting ? (
          /* 复用已有文档 */
          <Form.Item
            label="选择已有文档"
            name="existingDocumentId"
            rules={[{ required: true, message: '请选择文档' }]}
          >
            <Select
              showSearch
              placeholder="从项目文档库中选择"
              optionFilterProp="label"
              options={existingDocuments.map((d) => ({
                label: d.name,
                value: d.documentId,
              }))}
            />
          </Form.Item>
        ) : (
          /* 上传新文档（MVP：仅元数据） */
          <>
            <Form.Item
              label="文档名称"
              name="name"
              rules={[
                { required: true, message: '请输入文档名称' },
                { min: 2, message: '名称至少 2 个字符' },
              ]}
            >
              <Input
                placeholder="例如：PRD_v1.0.pdf"
                suffix={<Text type="secondary" style={{ fontSize: 11 }}>(.pdf / .docx / ...)</Text>}
              />
            </Form.Item>
            <Form.Item label="文件类型" name="mimeType">
              <Select options={MIME_OPTIONS} />
            </Form.Item>
            <Form.Item label="文件大小（KB，模拟）" name="size">
              <Input type="number" min={1} addonAfter="KB" />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: 12 }}>
              MVP 阶段无真实文件传输，仅记录元数据用于门禁验证。
            </Text>
          </>
        )}
      </Form>
    </Modal>
  );
}
