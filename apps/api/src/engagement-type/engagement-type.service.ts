import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';

@Injectable()
export class EngagementTypeService extends FirmScopedService {
  private readonly logger = new Logger(EngagementTypeService.name);

  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  /**
   * List all active engagement types visible to the current firm.
   * Uses unscopedPrisma because platform types have firmId: null
   * which the scoped client would filter out.
   */
  async listEngagementTypes() {
    const types = await this.unscopedPrisma.engagementType.findMany({
      where: {
        OR: [{ firmId: null }, { firmId: this.getFirmId() }],
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        recurrence: true,
        description: true,
        requiresPartnerApproval: true,
        defaultTaskTemplateId: true,
        firmId: true,
      },
    });

    return types.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      category: t.category,
      recurrence: t.recurrence,
      description: t.description,
      requiresPartnerApproval: t.requiresPartnerApproval,
      hasTemplate: t.defaultTaskTemplateId !== null,
      isCustom: t.firmId !== null,
    }));
  }

  /**
   * Get task template preview for an engagement type.
   * Returns the template items (title, assigneeRole, reviewerRole, dueOffsetDays, displayOrder)
   * or empty array if no template exists.
   */
  async getTemplatePreview(engagementTypeId: string) {
    const engagementType = await this.unscopedPrisma.engagementType.findFirst({
      where: {
        id: engagementTypeId,
        OR: [{ firmId: null }, { firmId: this.getFirmId() }],
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        defaultTaskTemplateId: true,
      },
    });

    if (!engagementType) {
      throw new NotFoundException('Engagement type not found');
    }

    if (!engagementType.defaultTaskTemplateId) {
      return { engagementTypeId: engagementType.id, engagementTypeName: engagementType.name, items: [] };
    }

    const template = await this.unscopedPrisma.taskTemplate.findFirst({
      where: {
        id: engagementType.defaultTaskTemplateId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        items: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            assigneeRole: true,
            reviewerRole: true,
            dueOffsetDays: true,
            displayOrder: true,
            dependsOnOrder: true,
            isRequired: true,
          },
        },
      },
    });

    if (!template) {
      return { engagementTypeId: engagementType.id, engagementTypeName: engagementType.name, items: [] };
    }

    return {
      engagementTypeId: engagementType.id,
      engagementTypeName: engagementType.name,
      templateId: template.id,
      templateName: template.name,
      items: template.items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        assigneeRole: item.assigneeRole,
        reviewerRole: item.reviewerRole,
        dueOffsetDays: item.dueOffsetDays,
        displayOrder: item.displayOrder,
        dependsOnOrder: item.dependsOnOrder,
        isRequired: item.isRequired,
      })),
    };
  }
}
