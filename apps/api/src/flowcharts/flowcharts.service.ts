import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { StoreService } from '../shared/store.service';
import { AuditService } from '../audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { Flowchart } from '../common/interfaces/entities.interface';
import { generateId } from '../common/utils/generate-id.util';
import { CreateFlowchartDto } from './dto/create-flowchart.dto';
import { CreateSubFlowchartDto } from './dto/create-sub-flowchart.dto';

@Injectable()
export class FlowchartsService {
  constructor(
    private readonly store: StoreService,
    private readonly auditService: AuditService,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * 获取项目下所有流程图（含子流程图）
   * - 验证项目存在
   * - 验证调用者有项目访问权限（通过 ProjectsService.findById 内部验证）
   */
  findByProject(projectId: string): Flowchart[] {
    this.projectsService.findById(projectId);
    return [...this.store.flowcharts.values()].filter(
      (f) => f.projectId === projectId,
    );
  }

  /**
   * 按 ID 查找流程图
   */
  findById(flowchartId: string): Flowchart {
    const flowchart = this.store.flowcharts.get(flowchartId);
    if (!flowchart) {
      throw new NotFoundException({
        code: 'FLOWCHART_NOT_FOUND',
        message: `流程图 ${flowchartId} 不存在`,
      });
    }
    return flowchart;
  }

  /**
   * 在项目下创建顶层流程图
   * - 验证项目存在
   * - 初始状态为 0（未开始），空图结构
   */
  create(
    projectId: string,
    dto: CreateFlowchartDto,
    actorId: string,
    requestId: string,
  ): Flowchart {
    this.projectsService.findById(projectId);

    const flowchartId = generateId('flowchart-');
    const now = new Date();

    const flowchart: Flowchart = {
      id: flowchartId,
      name: dto.name,
      description: dto.description,
      projectId,
      ownerId: dto.ownerId ?? actorId,
      nodeCount: 0,
      status: 0,
      createdAt: now,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      graphJson: { nodes: [], edges: [] },
      nodesConfig: [],
    };
    this.store.flowcharts.set(flowchartId, flowchart);

    this.auditService.record({
      projectId,
      requestId,
      actorId,
      action: 'CREATE_FLOWCHART',
      resourceType: 'Flowchart',
      resourceId: flowchartId,
      payload: { name: dto.name, projectId },
    });

    return flowchart;
  }

  /**
   * 在父流程图下创建子流程图
   * - 验证父流程图存在
   * - 子流程图与父流程图归属同一项目
   * - 写入 parentFlowchartId + parentNodeId
   */
  createSubFlowchart(
    parentFlowchartId: string,
    dto: CreateSubFlowchartDto,
    actorId: string,
    requestId: string,
  ): Flowchart {
    const parent = this.findById(parentFlowchartId);

    const flowchartId = generateId('flowchart-');
    const now = new Date();

    const subFlowchart: Flowchart = {
      id: flowchartId,
      name: dto.name,
      description: dto.description,
      projectId: parent.projectId,
      ownerId: dto.ownerId ?? actorId,
      parentFlowchartId,
      parentNodeId: dto.parentNodeId,
      nodeCount: 0,
      status: 0,
      createdAt: now,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      graphJson: { nodes: [], edges: [] },
      nodesConfig: [],
    };
    this.store.flowcharts.set(flowchartId, subFlowchart);

    this.auditService.record({
      projectId: parent.projectId,
      requestId,
      actorId,
      action: 'CREATE_SUB_FLOWCHART',
      resourceType: 'Flowchart',
      resourceId: flowchartId,
      payload: {
        name: dto.name,
        parentFlowchartId,
        parentNodeId: dto.parentNodeId,
      },
    });

    return subFlowchart;
  }

  /**
   * 删除流程图（级联删除所有后代子流程图）
   * - 仅允许删除存在的流程图
   * - 递归删除所有子流程图（DFS 后序遍历）
   * - 写审计日志
   */
  delete(
    flowchartId: string,
    actorId: string,
    requestId: string,
  ): void {
    const flowchart = this.findById(flowchartId);

    // 递归收集所有后代子流程图 ID
    const idsToDelete = this.collectDescendantIds(flowchartId);
    idsToDelete.push(flowchartId);

    for (const id of idsToDelete) {
      this.store.flowcharts.delete(id);
    }

    this.auditService.record({
      projectId: flowchart.projectId,
      requestId,
      actorId,
      action: 'DELETE_FLOWCHART',
      resourceType: 'Flowchart',
      resourceId: flowchartId,
      payload: { name: flowchart.name, cascadeCount: idsToDelete.length - 1 },
    });
  }

  /**
   * 递归收集指定流程图的所有后代子流程图 ID（不含自身）
   */
  private collectDescendantIds(parentId: string): string[] {
    const children = [...this.store.flowcharts.values()].filter(
      (f) => f.parentFlowchartId === parentId,
    );
    const result: string[] = [];
    for (const child of children) {
      result.push(...this.collectDescendantIds(child.id));
      result.push(child.id);
    }
    return result;
  }
}
