/**
 * 团队管理面板
 *
 * 以 Drawer 形式展示当前用户所在的所有团队，支持：
 * - 查看团队列表及成员
 * - 新建团队（填写名称、描述、初始成员 ID）
 * - 添加 / 移除成员（仅创建者可操作）
 * - 删除团队（仅创建者可操作，二次确认）
 */
import { useState } from 'react';
import {
  Button,
  Collapse,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getMyTeams,
  removeTeamMember,
} from '../../api/teams';
import { getTokenSnapshot } from '../../auth/token';
import type { Team } from '../../api/types';

const { Text, Title } = Typography;

interface TeamManagementProps {
  /** 面板是否可见 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 团队管理 Drawer 组件
 */
export default function TeamManagement({ open, onClose }: TeamManagementProps) {
  const queryClient = useQueryClient();
  const currentUserId = getTokenSnapshot()?.userId;

  /* 新建团队弹窗状态 */
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<{ name: string; description?: string; memberIds?: string }>();

  /* 添加成员弹窗状态 */
  const [addMemberModal, setAddMemberModal] = useState<{ open: boolean; teamId: string } | null>(null);
  const [addMemberForm] = Form.useForm<{ memberId: string }>();

  /* 查询当前用户团队列表 */
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: getMyTeams,
    enabled: open, // 仅在面板打开时拉取
    staleTime: 15000,
  });

  /** 刷新团队列表 */
  function invalidateTeams() {
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  }

  /* 创建团队 mutation */
  const createMut = useMutation({
    mutationFn: (dto: { name: string; description?: string; memberIds?: string[] }) =>
      createTeam(dto),
    onSuccess: () => {
      message.success('团队已创建');
      invalidateTeams();
      setCreateModalOpen(false);
      createForm.resetFields();
    },
  });

  /* 添加成员 mutation */
  const addMemberMut = useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) =>
      addTeamMember(teamId, memberId),
    onSuccess: () => {
      message.success('成员已添加');
      invalidateTeams();
      setAddMemberModal(null);
      addMemberForm.resetFields();
    },
  });

  /* 移除成员 mutation */
  const removeMemberMut = useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) =>
      removeTeamMember(teamId, memberId),
    onSuccess: () => {
      message.success('成员已移除');
      invalidateTeams();
    },
  });

  /* 删除团队 mutation */
  const deleteTeamMut = useMutation({
    mutationFn: (teamId: string) => deleteTeam(teamId),
    onSuccess: () => {
      message.success('团队已删除');
      invalidateTeams();
    },
  });

  /** 提交创建团队 */
  async function handleCreateTeam() {
    try {
      const values = await createForm.validateFields();
      /* 将逗号分隔的成员 ID 字符串转为数组 */
      const memberIds = values.memberIds
        ? values.memberIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      createMut.mutate({ name: values.name.trim(), description: values.description?.trim(), memberIds });
    } catch {
      // 表单验证失败，不做处理
    }
  }

  /** 提交添加成员 */
  async function handleAddMember() {
    if (!addMemberModal) return;
    try {
      const values = await addMemberForm.validateFields();
      addMemberMut.mutate({ teamId: addMemberModal.teamId, memberId: values.memberId.trim() });
    } catch {
      // 表单验证失败，不做处理
    }
  }

  /** 渲染单个团队面板内容 */
  function renderTeamContent(team: Team) {
    const isCreator = team.creatorId === currentUserId;

    return (
      <div>
        {/* 团队描述 */}
        {team.description && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {team.description}
          </Text>
        )}

        {/* 成员列表 */}
        <List
          size="small"
          header={
            <Space>
              <UserOutlined />
              <Text style={{ fontSize: 12, fontWeight: 500 }}>成员列表（{team.memberIds.length} 人）</Text>
            </Space>
          }
          dataSource={team.memberIds}
          renderItem={(memberId) => (
            <List.Item
              key={memberId}
              actions={
                isCreator && memberId !== team.creatorId
                  ? [
                      <Popconfirm
                        key="remove"
                        title={`确定移除成员 ${memberId}？`}
                        onConfirm={() =>
                          removeMemberMut.mutate({ teamId: team.id, memberId })
                        }
                        okText="移除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<MinusCircleOutlined />}
                          loading={removeMemberMut.isPending}
                        />
                      </Popconfirm>,
                    ]
                  : undefined
              }
            >
              <Space size={6}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--color-primary-bg)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {memberId.charAt(0).toUpperCase()}
                </div>
                <Text style={{ fontSize: 13 }}>{memberId}</Text>
                {memberId === team.creatorId && (
                  <Tag color="gold" style={{ fontSize: 10, padding: '0 4px' }}>创建者</Tag>
                )}
              </Space>
            </List.Item>
          )}
          locale={{ emptyText: '暂无成员' }}
        />

        {/* 创建者操作区 */}
        {isCreator && (
          <Space style={{ marginTop: 12 }} wrap>
            <Button
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => setAddMemberModal({ open: true, teamId: team.id })}
            >
              添加成员
            </Button>
            <Popconfirm
              title="确定删除此团队？"
              description="删除后无法恢复。团队下的项目不会被删除，但团队绑定将失效。"
              onConfirm={() => deleteTeamMut.mutate(team.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deleteTeamMut.isPending}
              >
                删除团队
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>
    );
  }

  /** 构建 Collapse items */
  const collapseItems = teams.map((team) => ({
    key: team.id,
    label: (
      <Space>
        <TeamOutlined style={{ color: 'var(--color-primary)' }} />
        <Text strong style={{ fontSize: 14 }}>{team.name}</Text>
        <Tag style={{ fontSize: 11 }}>{team.memberIds.length} 人</Tag>
        {team.creatorId === currentUserId && (
          <Tag color="purple" style={{ fontSize: 10, padding: '0 4px' }}>我创建的</Tag>
        )}
      </Space>
    ),
    children: renderTeamContent(team),
  }));

  return (
    <>
      {/* 团队管理 Drawer */}
      <Drawer
        title={
          <Space>
            <TeamOutlined />
            <span>团队管理</span>
          </Space>
        }
        open={open}
        onClose={onClose}
        width={480}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => setCreateModalOpen(true)}
          >
            新建团队
          </Button>
        }
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
            <TeamOutlined style={{ fontSize: 48, opacity: 0.3, display: 'block', marginBottom: 12 }} />
            <Title level={5} type="secondary">暂无团队</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              点击右上角「新建团队」创建你的第一个团队
            </Text>
          </div>
        ) : (
          <Collapse
            items={collapseItems}
            ghost
            accordion={false}
          />
        )}
      </Drawer>

      {/* 新建团队弹窗 */}
      <Modal
        title="新建团队"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreateTeam}
        okText="创建"
        cancelText="取消"
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="团队名称"
            name="name"
            rules={[
              { required: true, message: '请输入团队名称' },
              { min: 2, message: '名称至少 2 个字符' },
              { max: 50, message: '名称不超过 50 个字符' },
            ]}
          >
            <Input placeholder="例如：前端研发团队" autoFocus maxLength={50} />
          </Form.Item>
          <Form.Item label="团队描述" name="description">
            <Input.TextArea placeholder="可选，简述团队职责" rows={2} maxLength={200} />
          </Form.Item>
          <Form.Item
            label="初始成员 ID"
            name="memberIds"
            extra="多个成员 ID 用逗号分隔，例如：user-001,user-002"
          >
            <Input placeholder="user-001,user-002（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加成员弹窗 */}
      <Modal
        title="添加团队成员"
        open={addMemberModal?.open ?? false}
        onCancel={() => {
          setAddMemberModal(null);
          addMemberForm.resetFields();
        }}
        onOk={handleAddMember}
        okText="添加"
        cancelText="取消"
        confirmLoading={addMemberMut.isPending}
        destroyOnClose
      >
        <Form form={addMemberForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="成员用户 ID"
            name="memberId"
            rules={[{ required: true, message: '请输入成员 ID' }]}
          >
            <Input placeholder="例如：user-abc123" autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
