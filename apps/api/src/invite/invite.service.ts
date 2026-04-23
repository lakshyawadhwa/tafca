import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole } from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { AuthService } from '../auth/auth.service';
import { CreateInviteDto } from './dto/create-invite.dto';

const INVITE_EXPIRY_DAYS = 7;

export interface InviteRecord {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  expiresAt: string;
  invitedBy: string;
  inviteUrl?: string;
}

export interface InvitePreview {
  email: string;
  fullName: string;
  role: UserRole;
  firmName: string;
  expiresAt: string;
}

@Injectable()
export class InviteService extends FirmScopedService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    prismaService: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super(prismaService);
  }

  async createInvite(dto: CreateInviteDto): Promise<InviteRecord> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists in the firm');
    }

    const existingPending = await this.prisma.invite.findFirst({
      where: {
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingPending) {
      throw new ConflictException('An active invite already exists for this email');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: {
        firmId: this.getFirmId(),
        email: normalizedEmail,
        fullName: dto.fullName,
        role: dto.role,
        tokenHash,
        expiresAt,
        invitedBy: this.getUserId(),
      },
    });

    this.logger.log(`Invite ${invite.id} created for ${normalizedEmail} (firm ${this.getFirmId()})`);

    return {
      id: invite.id,
      email: invite.email,
      fullName: invite.fullName,
      role: invite.role as UserRole,
      expiresAt: invite.expiresAt.toISOString(),
      invitedBy: invite.invitedBy,
      inviteUrl: this.buildInviteUrl(rawToken),
    };
  }

  async listPending(): Promise<InviteRecord[]> {
    const rows = await this.prisma.invite.findMany({
      where: {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.fullName,
      role: r.role as UserRole,
      expiresAt: r.expiresAt.toISOString(),
      invitedBy: r.invitedBy,
    }));
  }

  async revoke(id: string): Promise<void> {
    const row = await this.prisma.invite.findFirst({ where: { id } });
    if (!row) throw new NotFoundException('Invite not found');
    if (row.acceptedAt) throw new BadRequestException('Invite already accepted');
    if (row.revokedAt) return;

    await this.prisma.invite.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Invite ${id} revoked`);
  }

  async preview(token: string): Promise<InvitePreview> {
    const invite = await this.findActiveByToken(token);
    const firm = await this.prismaService.unscoped.firm.findUniqueOrThrow({
      where: { id: invite.firmId },
      select: { name: true, displayName: true },
    });
    return {
      email: invite.email,
      fullName: invite.fullName,
      role: invite.role as UserRole,
      firmName: firm.displayName ?? firm.name,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async accept(
    token: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const invite = await this.findActiveByToken(token);

    const duplicate = await this.prismaService.unscoped.user.findFirst({
      where: {
        firmId: invite.firmId,
        email: invite.email,
        deletedAt: null,
      },
    });
    if (duplicate) {
      throw new ConflictException('A user with this email already exists in the firm');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prismaService.unscoped.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firmId: invite.firmId,
          email: invite.email,
          fullName: invite.fullName,
          role: invite.role,
          passwordHash,
          isActive: true,
          createdBy: invite.invitedBy,
          updatedBy: invite.invitedBy,
        },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });

    this.logger.log(`Invite ${invite.id} accepted, user ${user.id} created`);

    return this.authService.issueSession(user.id, ipAddress, userAgent);
  }

  private async findActiveByToken(token: string) {
    if (!token || token.length < 32) {
      throw new BadRequestException('Invalid invite token');
    }
    const tokenHash = this.hashToken(token);
    const invite = await this.prismaService.unscoped.invite.findUnique({
      where: { tokenHash },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.acceptedAt) throw new GoneException('Invite already accepted');
    if (invite.revokedAt) throw new GoneException('Invite has been revoked');
    if (invite.expiresAt <= new Date()) throw new GoneException('Invite has expired');
    return invite;
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private buildInviteUrl(token: string): string {
    const base = this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:5173';
    return `${base.replace(/\/$/, '')}/accept-invite?token=${token}`;
  }
}
