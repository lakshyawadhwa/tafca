import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { UserRole, EngagementStatus } from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import {
  ClientResponseDto,
  PaginatedClientsResponseDto,
  GstNumberResponseDto,
} from './dto/client-response.dto';
import { CreateGstNumberDto } from './dto/create-gst-number.dto';
import { UpdateGstNumberDto } from './dto/update-gst-number.dto';

const CLIENT_SELECT = {
  id: true,
  displayName: true,
  legalName: true,
  entityType: true,
  constitution: true,
  status: true,
  pan: true,
  tan: true,
  cin: true,
  primaryContactName: true,
  primaryContactPhone: true,
  primaryContactEmail: true,
  address: true,
  notes: true,
  tags: true,
  customFields: true,
  financialYearEnd: true,
  assignedPartnerId: true,
  assignedManagerId: true,
  assignedJuniorId: true,
  assignedArticleId: true,
  onboardedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const CLIENT_LIST_SELECT = {
  id: true,
  displayName: true,
  legalName: true,
  entityType: true,
  status: true,
  pan: true,
  tags: true,
  assignedPartnerId: true,
  assignedManagerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const GST_NUMBER_SELECT = {
  id: true,
  gstin: true,
  stateCode: true,
  tradeName: true,
  registrationType: true,
  isPrimary: true,
  registeredAt: true,
  cancelledAt: true,
  createdAt: true,
} as const;

/** Maps assignment DTO fields to the required UserRole. */
const ASSIGNMENT_ROLE_MAP: Record<string, UserRole> = {
  assignedPartnerId: UserRole.PARTNER,
  assignedManagerId: UserRole.MANAGER,
  assignedJuniorId: UserRole.JUNIOR_CA,
  assignedArticleId: UserRole.ARTICLE,
};

@Injectable()
export class ClientService extends FirmScopedService {
  private readonly logger = new Logger(ClientService.name);

  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  /**
   * Create a new client in the current firm.
   * Validates displayName uniqueness (case-insensitive) and role assignments.
   */
  async createClient(dto: CreateClientDto): Promise<ClientResponseDto> {
    // Check displayName uniqueness within firm (case-insensitive)
    await this.assertDisplayNameUnique(dto.displayName);

    // Validate role assignments
    await this.validateAssignments(dto);

    const userId = this.getUserId();

    const client = await this.prisma.client.create({
      data: {
        firmId: this.getFirmId(),
        displayName: dto.displayName,
        legalName: dto.legalName || null,
        entityType: dto.entityType,
        constitution: dto.constitution || null,
        status: dto.status, // Prisma default handles undefined -> ACTIVE
        pan: dto.pan || null,
        tan: dto.tan || null,
        cin: dto.cin || null,
        primaryContactName: dto.primaryContactName || null,
        primaryContactPhone: dto.primaryContactPhone || null,
        primaryContactEmail: dto.primaryContactEmail || null,
        address: dto.address || undefined,
        notes: dto.notes || null,
        tags: dto.tags || [],
        financialYearEnd: dto.financialYearEnd,
        assignedPartnerId: dto.assignedPartnerId || null,
        assignedManagerId: dto.assignedManagerId || null,
        assignedJuniorId: dto.assignedJuniorId || null,
        assignedArticleId: dto.assignedArticleId || null,
        createdBy: userId,
        updatedBy: userId,
      },
      select: {
        ...CLIENT_SELECT,
        gstNumbers: { where: { deletedAt: null }, select: GST_NUMBER_SELECT },
        _count: { select: { engagements: true, tasks: true } },
      },
    });

    this.logger.log(`Client created: ${client.id} (${client.displayName})`);
    return this.toClientResponse(client);
  }

  /**
   * List clients in the current firm with pagination, search, and filters.
   */
  async listClients(
    query: ListClientsQueryDto,
  ): Promise<PaginatedClientsResponseDto> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      entityType,
      tag,
      assignedPartnerId,
      sortBy = 'displayName',
      sortOrder = 'asc',
    } = query;

    const where: Record<string, any> = {};

    if (status !== undefined) {
      where.status = status;
    }

    if (entityType !== undefined) {
      where.entityType = entityType;
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (assignedPartnerId) {
      where.assignedPartnerId = assignedPartnerId;
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { pan: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          ...CLIENT_LIST_SELECT,
          _count: { select: { engagements: true, tasks: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: data.map((c) => this.toClientListResponse(c)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single client by ID with GST numbers, engagement/task counts.
   */
  async getClient(id: string): Promise<ClientResponseDto> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: {
        ...CLIENT_SELECT,
        gstNumbers: { where: { deletedAt: null }, select: GST_NUMBER_SELECT },
        _count: { select: { engagements: true, tasks: true } },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return this.toClientResponse(client);
  }

  /**
   * Update a client by ID.
   * Validates displayName uniqueness if changed, and role assignments.
   */
  async updateClient(
    id: string,
    dto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    // Verify client exists
    const existing = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, displayName: true },
    });

    if (!existing) {
      throw new NotFoundException('Client not found');
    }

    // Check displayName uniqueness if it's being changed
    if (dto.displayName !== undefined && dto.displayName !== existing.displayName) {
      await this.assertDisplayNameUnique(dto.displayName, id);
    }

    // Validate role assignments for any assignment fields provided
    await this.validateAssignments(dto);

    const data: Record<string, any> = {
      updatedBy: this.getUserId(),
    };

    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.legalName !== undefined) data.legalName = dto.legalName;
    if (dto.entityType !== undefined) data.entityType = dto.entityType;
    if (dto.constitution !== undefined) data.constitution = dto.constitution;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.pan !== undefined) data.pan = dto.pan;
    if (dto.tan !== undefined) data.tan = dto.tan;
    if (dto.cin !== undefined) data.cin = dto.cin;
    if (dto.primaryContactName !== undefined) data.primaryContactName = dto.primaryContactName;
    if (dto.primaryContactPhone !== undefined) data.primaryContactPhone = dto.primaryContactPhone;
    if (dto.primaryContactEmail !== undefined) data.primaryContactEmail = dto.primaryContactEmail;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.financialYearEnd !== undefined) data.financialYearEnd = dto.financialYearEnd;
    if (dto.assignedPartnerId !== undefined) data.assignedPartnerId = dto.assignedPartnerId;
    if (dto.assignedManagerId !== undefined) data.assignedManagerId = dto.assignedManagerId;
    if (dto.assignedJuniorId !== undefined) data.assignedJuniorId = dto.assignedJuniorId;
    if (dto.assignedArticleId !== undefined) data.assignedArticleId = dto.assignedArticleId;

    const updated = await this.prisma.client.update({
      where: { id },
      data,
      select: {
        ...CLIENT_SELECT,
        gstNumbers: { where: { deletedAt: null }, select: GST_NUMBER_SELECT },
        _count: { select: { engagements: true, tasks: true } },
      },
    });

    this.logger.log(`Client updated: ${updated.id}`);
    return this.toClientResponse(updated);
  }

  /**
   * Soft-delete a client. Blocked if active engagements exist.
   */
  async deleteClient(id: string): Promise<void> {
    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Check for active engagements (ACTIVE or ON_HOLD)
    const activeEngagementCount = await this.prisma.engagement.count({
      where: {
        clientId: id,
        status: { in: [EngagementStatus.ACTIVE, EngagementStatus.ON_HOLD] },
      },
    });

    if (activeEngagementCount > 0) {
      throw new ConflictException(
        `Cannot delete this client. ${activeEngagementCount} active engagement${activeEngagementCount > 1 ? 's' : ''} must be completed or cancelled first.`,
      );
    }

    // Soft-delete
    await this.prisma.client.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: this.getUserId(),
      },
    });

    this.logger.log(`Client soft-deleted: ${id}`);
  }

  // ───────────────────────── GST Number CRUD ─────────────────────────

  /**
   * Add a GST number to a client.
   * If isPrimary, unsets current primary in a transaction.
   */
  async addGstNumber(
    clientId: string,
    dto: CreateGstNumberDto,
  ): Promise<GstNumberResponseDto> {
    // Verify client exists
    await this.assertClientExists(clientId);

    const userId = this.getUserId();
    const firmId = this.getFirmId();

    if (dto.isPrimary) {
      // Use the unscoped prisma for transaction, manually inject firmId
      const result = await this.unscopedPrisma.$transaction(async (tx) => {
        // Unset current primary
        await tx.clientGstNumber.updateMany({
          where: { clientId, firmId, isPrimary: true, deletedAt: null },
          data: { isPrimary: false, updatedBy: userId },
        });

        // Create the new GST number
        return tx.clientGstNumber.create({
          data: {
            clientId,
            firmId,
            gstin: dto.gstin,
            stateCode: dto.stateCode,
            tradeName: dto.tradeName || null,
            registrationType: dto.registrationType,
            isPrimary: true,
            registeredAt: dto.registeredAt ? new Date(dto.registeredAt) : null,
            cancelledAt: dto.cancelledAt ? new Date(dto.cancelledAt) : null,
            createdBy: userId,
            updatedBy: userId,
          },
          select: GST_NUMBER_SELECT,
        });
      });

      return this.toGstNumberResponse(result);
    }

    // Non-primary — simple create
    const gstNumber = await this.prisma.clientGstNumber.create({
      data: {
        clientId,
        firmId: this.getFirmId(),
        gstin: dto.gstin,
        stateCode: dto.stateCode,
        tradeName: dto.tradeName || null,
        registrationType: dto.registrationType,
        isPrimary: false,
        registeredAt: dto.registeredAt ? new Date(dto.registeredAt) : null,
        cancelledAt: dto.cancelledAt ? new Date(dto.cancelledAt) : null,
        createdBy: userId,
        updatedBy: userId,
      },
      select: GST_NUMBER_SELECT,
    });

    this.logger.log(`GST number added to client ${clientId}: ${gstNumber.id}`);
    return this.toGstNumberResponse(gstNumber);
  }

  /**
   * Update a GST number. If setting isPrimary, unsets current primary in a transaction.
   */
  async updateGstNumber(
    clientId: string,
    gstId: string,
    dto: UpdateGstNumberDto,
  ): Promise<GstNumberResponseDto> {
    // Verify GST number belongs to this client
    await this.assertGstNumberBelongsToClient(clientId, gstId);

    const userId = this.getUserId();
    const firmId = this.getFirmId();

    const data: Record<string, any> = { updatedBy: userId };

    if (dto.gstin !== undefined) data.gstin = dto.gstin;
    if (dto.stateCode !== undefined) data.stateCode = dto.stateCode;
    if (dto.tradeName !== undefined) data.tradeName = dto.tradeName;
    if (dto.registrationType !== undefined) data.registrationType = dto.registrationType;
    if (dto.registeredAt !== undefined) data.registeredAt = dto.registeredAt ? new Date(dto.registeredAt) : null;
    if (dto.cancelledAt !== undefined) data.cancelledAt = dto.cancelledAt ? new Date(dto.cancelledAt) : null;

    if (dto.isPrimary === true) {
      // Transaction: unset current primary, then update this one
      const result = await this.unscopedPrisma.$transaction(async (tx) => {
        await tx.clientGstNumber.updateMany({
          where: { clientId, firmId, isPrimary: true, deletedAt: null },
          data: { isPrimary: false, updatedBy: userId },
        });

        return tx.clientGstNumber.update({
          where: { id: gstId },
          data: { ...data, isPrimary: true },
          select: GST_NUMBER_SELECT,
        });
      });

      return this.toGstNumberResponse(result);
    }

    if (dto.isPrimary !== undefined) {
      data.isPrimary = dto.isPrimary;
    }

    const updated = await this.prisma.clientGstNumber.update({
      where: { id: gstId },
      data,
      select: GST_NUMBER_SELECT,
    });

    this.logger.log(`GST number updated: ${gstId}`);
    return this.toGstNumberResponse(updated);
  }

  /**
   * Soft-delete a GST number.
   */
  async deleteGstNumber(clientId: string, gstId: string): Promise<void> {
    await this.assertGstNumberBelongsToClient(clientId, gstId);

    await this.prisma.clientGstNumber.update({
      where: { id: gstId },
      data: {
        deletedAt: new Date(),
        deletedBy: this.getUserId(),
      },
    });

    this.logger.log(`GST number soft-deleted: ${gstId}`);
  }

  // ───────────────────────── Private Helpers ─────────────────────────

  /**
   * Check that displayName is unique within the firm (case-insensitive).
   * Optionally exclude a specific client ID (for updates).
   */
  private async assertDisplayNameUnique(
    displayName: string,
    excludeId?: string,
  ): Promise<void> {
    const where: Record<string, any> = {
      displayName: { equals: displayName, mode: 'insensitive' },
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const existing = await this.prisma.client.findFirst({ where });

    if (existing) {
      throw new ConflictException(
        'Client with this display name already exists in your firm',
      );
    }
  }

  /**
   * Validate that assignment user IDs point to users with the correct role.
   * Uses Promise.all for parallel lookups.
   */
  private async validateAssignments(
    dto: Partial<Pick<CreateClientDto, 'assignedPartnerId' | 'assignedManagerId' | 'assignedJuniorId' | 'assignedArticleId'>>,
  ): Promise<void> {
    const checks: Promise<void>[] = [];

    for (const [field, requiredRole] of Object.entries(ASSIGNMENT_ROLE_MAP)) {
      const userId = (dto as any)[field];
      if (userId) {
        checks.push(this.assertUserHasRole(userId, requiredRole, field));
      }
    }

    if (checks.length > 0) {
      await Promise.all(checks);
    }
  }

  /**
   * Verify a user exists in the firm and has the required role.
   */
  private async assertUserHasRole(
    userId: string,
    requiredRole: UserRole,
    fieldName: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });

    if (!user) {
      throw new BadRequestException(
        `User ${userId} not found in this firm (field: ${fieldName})`,
      );
    }

    if (!user.isActive) {
      throw new BadRequestException(
        `User ${userId} is deactivated and cannot be assigned (field: ${fieldName})`,
      );
    }

    // Allow PARTNER for manager slot (partners can also manage)
    const roleLabel = fieldName.replace('assigned', '').replace('Id', '');
    if (fieldName === 'assignedManagerId') {
      if (user.role !== UserRole.MANAGER && user.role !== UserRole.PARTNER) {
        throw new BadRequestException(
          `Assigned manager must have MANAGER or PARTNER role`,
        );
      }
    } else if (user.role !== requiredRole) {
      throw new BadRequestException(
        `Assigned ${roleLabel.toLowerCase()} must have ${requiredRole} role`,
      );
    }
  }

  /**
   * Assert that a client exists (by ID, firm-scoped).
   */
  private async assertClientExists(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  /**
   * Assert that a GST number exists and belongs to the given client.
   */
  private async assertGstNumberBelongsToClient(
    clientId: string,
    gstId: string,
  ): Promise<void> {
    const gstNumber = await this.prisma.clientGstNumber.findUnique({
      where: { id: gstId },
      select: { clientId: true },
    });

    if (!gstNumber) {
      throw new NotFoundException('GST number not found');
    }

    if (gstNumber.clientId !== clientId) {
      throw new BadRequestException(
        'GST number does not belong to this client',
      );
    }
  }

  /**
   * Map a Prisma client record (with includes) to the response DTO.
   */
  private toClientResponse(client: any): ClientResponseDto {
    return {
      id: client.id,
      displayName: client.displayName,
      legalName: client.legalName,
      entityType: client.entityType,
      constitution: client.constitution,
      status: client.status,
      pan: client.pan,
      tan: client.tan,
      cin: client.cin,
      primaryContactName: client.primaryContactName,
      primaryContactPhone: client.primaryContactPhone,
      primaryContactEmail: client.primaryContactEmail,
      address: client.address as Record<string, unknown> | null,
      notes: client.notes,
      tags: client.tags,
      financialYearEnd: client.financialYearEnd,
      assignedPartnerId: client.assignedPartnerId,
      assignedManagerId: client.assignedManagerId,
      assignedJuniorId: client.assignedJuniorId,
      assignedArticleId: client.assignedArticleId,
      onboardedAt: client.onboardedAt?.toISOString() || null,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      gstNumbers: (client.gstNumbers || []).map((g: any) =>
        this.toGstNumberResponse(g),
      ),
      _count: client._count || { engagements: 0, tasks: 0 },
    };
  }

  /**
   * Map a Prisma client record (list select) to a partial response.
   * For list view, we return a lighter response without gstNumbers, notes, address.
   */
  private toClientListResponse(client: any): ClientResponseDto {
    return {
      id: client.id,
      displayName: client.displayName,
      legalName: client.legalName || null,
      entityType: client.entityType,
      constitution: null,
      status: client.status,
      pan: client.pan,
      tan: null,
      cin: null,
      primaryContactName: null,
      primaryContactPhone: null,
      primaryContactEmail: null,
      address: null,
      notes: null,
      tags: client.tags,
      financialYearEnd: 3,
      assignedPartnerId: client.assignedPartnerId,
      assignedManagerId: client.assignedManagerId || null,
      assignedJuniorId: null,
      assignedArticleId: null,
      onboardedAt: null,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      gstNumbers: [],
      _count: client._count || { engagements: 0, tasks: 0 },
    };
  }

  /**
   * Map a GST number record to the response DTO.
   */
  private toGstNumberResponse(gst: any): GstNumberResponseDto {
    return {
      id: gst.id,
      gstin: gst.gstin,
      stateCode: gst.stateCode,
      tradeName: gst.tradeName,
      registrationType: gst.registrationType,
      isPrimary: gst.isPrimary,
      registeredAt: gst.registeredAt?.toISOString() || null,
      cancelledAt: gst.cancelledAt?.toISOString() || null,
      createdAt: gst.createdAt.toISOString(),
    };
  }
}
