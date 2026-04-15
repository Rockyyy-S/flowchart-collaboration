import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StoreService } from '../shared/store.service';
import { NotificationTask } from '../common/interfaces/entities.interface';

export interface PublishEventParams {
  eventType: string;
  receivers: string[];
  channel?: 'IN_APP' | 'EMAIL';
  payload?: Record<string, unknown>;
}

/**
 * 通知编排服务（MVP 占位实现）
 *
 * 当前行为：写内存队列 + 打印日志，通知不阻断主流程。
 *
 * 替换指引（正式版本）：
 * - 将 publishEvent 替换为 BullMQ Job enqueue（Redis）
 * - 通知消费者（worker）异步处理站内信和邮件发送
 * - 保持此接口签名不变
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly store: StoreService) {}

  /** 发布领域事件通知 */
  publishEvent(params: PublishEventParams): void {
    const { eventType, receivers, channel = 'IN_APP', payload } = params;

    for (const receiver of receivers) {
      const task: NotificationTask = {
        id: uuidv4(),
        eventType,
        channel,
        receiver,
        status: 'PENDING',
        retryCount: 0,
        payload,
        createdAt: new Date(),
      };
      this.store.notificationTasks.push(task);
      // MVP 占位：直接标记为已发送
      task.status = 'SENT';
      this.logger.log(
        `[通知占位] 事件=${eventType} 接收人=${receiver} 渠道=${channel}`,
      );
    }
  }

  findAll(): NotificationTask[] {
    return [...this.store.notificationTasks];
  }
}
