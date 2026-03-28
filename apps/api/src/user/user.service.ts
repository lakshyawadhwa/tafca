import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole, TaskStatus } from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { SessionService } from '../session/session.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import {
  UserResponseDto,
  PaginatedUsersResponseDto,
  DeactivateUserResponseDto,
} from './dto/user-response.dto';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  phone: true,
  isActive: true,
  avatarUrl: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UserService extends FirmScopedService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    prismaService: PrismaService,
    private readonly sessionService: SessionService,
  ) {
    super(prismaService);
  }

  /**
   * List users in the current firm with optional filters.
   * Firm scoping and soft-delete filtering are handled automatically by the scoped Prisma client.
   */
  async listUsers(
    query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const { role, isActive, search, page = 1, limit = 20 } = query;

    const where: Record<string, any> = {};

    if (role !== undefined) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => this.toUserResponse(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new user in the current firm.
   * Email uniqueness is enforced within the firm scope.
   */
  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check email uniqueness within firm (firm scoping is automatic)
    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('Email already exists in this firm');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        firmId: this.getFirmId(),
        email: normalizedEmail,
        fullName: dto.fullName,
        role: dto.role,
        phone: dto.phone || null,
        passwordHash,
        isActive: true,
        createdBy: this.getUserId(),
        updatedBy: this.getUserId(),
      },
      select: USER_SELECT,
    });

    this.logger.log(`User created: ${user.id} (${user.email})`);
    return this.toUserResponse(user);
  }

  /**
   * Update a user's profile fields.
   * If role changes, records a UserRoleHistory entry.
   */
  async updateUser(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Find the user (firm-scoped, soft-delete filtered)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Record role change if role is changing
    if (dto.role !== undefined && dto.role !== user.role) {
      await this.prisma.userRoleHistory.create({
        data: {
          firmId: this.getFirmId(),
          userId,
          oldRole: user.role,
          newRole: dto.role,
          changedBy: this.getUserId(),
        },
      });
    }

    // Build update data from non-undefined dto fields
    const data: Record<string, any> = {
      updatedBy: this.getUserId(),
    };

    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.notificationPreferences !== undefined)
      data.notificationPreferences = dto.notificationPreferences;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });

    this.logger.log(`User updated: ${updated.id}`);
    return this.toUserResponse(updated);
  }

  /**
   * Deactivate a user. Enforces:
   * - Cannot deactivate an already inactive user
   * - Cannot deactivate the last active PARTNER or ADMIN in the firm (USER-05)
   * - Returns count of open tasks assigned to the user (USER-04)
   * - Invalidates all user sessions
   */
  async deactivateUser(userId: string): Promise<DeactivateUserResponseDto> {
    // Find the user (firm-scoped, soft-delete filtered)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.isActive) {
      throw new BadRequestException('User is already deactivated');
    }

    // USER-05: Cannot deactivate the last active PARTNER or ADMIN
    if (user.role === UserRole.PARTNER || user.role === UserRole.ADMIN) {
      const activeCount = await this.prisma.user.count({
        where: { role: user.role, isActive: true },
      });

      if (activeCount <= 1) {
        throw new ConflictException(
          `Cannot deactivate the last active ${user.role} in this firm`,
        );
      }
    }

    // USER-04: Count open tasks assigned to this user
    // Open tasks = anything not DONE or CANCELLED
    let openTasksCount = 0;
    try {
      openTasksCount = await this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
          },
        },
      });
    } catch (err) {
      // Task table might not be migrated yet - return 0
      this.logger.warn(
        'Could not query tasks for deactivation count',
        (err as Error).message,
      );
    }

    // Deactivate the user
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, updatedBy: this.getUserId() },
    });

    // Invalidate all sessions for the deactivated user
    await this.sessionService.deleteAllUserSessions(userId);

    this.logger.log(
      `User deactivated: ${userId} (open tasks: ${openTasksCount})`,
    );

    return {
      user: { id: userId, isActive: false },
      openTasksCount,
    };
  }

  /**
   * Map a Prisma user record to the response DTO.
   */
  private toUserResponse(user: {
    id: string;
    email: string;
    fullName: string;
    role: any;
    phone: string | null;
    isActive: boolean;
    avatarUrl: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      phone: user.phone,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
