import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { RedisService } from '../common/services/redis.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AUTH_CONSTANTS } from './constants/auth.constants';
import { UserRole } from '@ca-practice-os/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * POST /auth/register
   *
   * 1. Check if email exists across any firm
   * 2. Create firm + user in a transaction
   * 3. Create session
   * 4. Sign access + refresh tokens
   * 5. Return tokens + user/firm info
   */
  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RegisterResponseDto & { refreshToken: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check if email already exists (any firm)
    const existingUser = await this.prisma.unscoped.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      dto.password,
      AUTH_CONSTANTS.BCRYPT_ROUNDS,
    );

    // Generate user ID upfront so we can set createdBy/updatedBy
    const userId = crypto.randomUUID();

    // Create firm and user in a transaction
    const { firm, user } = await this.prisma.unscoped.$transaction(
      async (tx) => {
        // Create firm with placeholder createdBy
        const firm = await tx.firm.create({
          data: {
            name: dto.firmName,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        // Create user with explicit ID
        const user = await tx.user.create({
          data: {
            id: userId,
            firmId: firm.id,
            email: normalizedEmail,
            fullName: dto.fullName,
            role: UserRole.PARTNER,
            passwordHash,
            isActive: true,
            phone: dto.phone || null,
            createdBy: userId,
            updatedBy: userId,
            lastLoginAt: new Date(),
          },
        });

        return { firm, user };
      },
    );

    // Generate session ID and sign tokens
    const sessionId = crypto.randomUUID();

    const accessToken = this.signAccessToken({
      sub: user.id,
      firmId: firm.id,
      role: user.role as UserRole,
      email: user.email,
      sessionId,
    });

    const refreshToken = this.signRefreshToken({
      sub: user.id,
      sessionId,
    });

    // Create session
    await this.sessionService.createSession({
      id: sessionId,
      userId: user.id,
      firmId: firm.id,
      role: user.role as UserRole,
      jwt: accessToken,
      ipAddress,
      userAgent,
    });

    this.logger.log(
      `New firm "${dto.firmName}" registered by user ${user.id}`,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
        firmId: firm.id,
      },
      firm: {
        id: firm.id,
        name: firm.name,
        displayName: firm.displayName,
      },
    };
  }

  /**
   * POST /auth/login
   *
   * 1. Check account lockout
   * 2. Find user by email (check deactivated separately for AUTH-07)
   * 3. Verify password
   * 4. Create session
   * 5. Sign access + refresh tokens
   * 6. Return tokens + user profile
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto & { refreshToken: string }> {
    const { email, password } = dto;
    const normalizedEmail = email.toLowerCase().trim();

    // Check account lockout
    await this.checkAccountLockout(normalizedEmail);

    // First check if user exists at all (for deactivated user detection per AUTH-07)
    const userRecord = await this.prisma.unscoped.user.findFirst({
      where: {
        email: normalizedEmail,
        deletedAt: null,
      },
      include: {
        firm: {
          select: { id: true, name: true, deletedAt: true },
        },
      },
    });

    // User not found at all
    if (!userRecord || userRecord.firm.deletedAt) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    // User exists but is deactivated (AUTH-07)
    if (!userRecord.isActive) {
      throw new ForbiddenException('Account deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      userRecord.passwordHash,
    );
    if (!isPasswordValid) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Clear failed login attempts on success
    await this.clearFailedAttempts(normalizedEmail);

    // Generate session ID and sign tokens
    const sessionId = crypto.randomUUID();

    const accessToken = this.signAccessToken({
      sub: userRecord.id,
      firmId: userRecord.firmId,
      role: userRecord.role as UserRole,
      email: userRecord.email,
      sessionId,
    });

    const refreshToken = this.signRefreshToken({
      sub: userRecord.id,
      sessionId,
    });

    // Create session (enforces max sessions internally)
    await this.sessionService.createSession({
      id: sessionId,
      userId: userRecord.id,
      firmId: userRecord.firmId,
      role: userRecord.role as UserRole,
      jwt: accessToken,
      ipAddress,
      userAgent,
    });

    // Update last login timestamp
    await this.prisma.unscoped.user.update({
      where: { id: userRecord.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(
      `User ${userRecord.id} logged in (session: ${sessionId})`,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        fullName: userRecord.fullName,
        role: userRecord.role as UserRole,
        firmId: userRecord.firmId,
        firmName: userRecord.firm.name,
        avatarUrl: userRecord.avatarUrl,
      },
    };
  }

  /**
   * POST /auth/refresh
   *
   * 1. Verify refresh token JWT
   * 2. Validate session exists
   * 3. Look up user for fresh claims
   * 4. Sign new access + refresh tokens
   * 5. Return new access token (controller sets refresh cookie)
   */
  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded: { sub: string; sessionId: string; type: string };

    try {
      decoded = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Validate session still exists
    const sessionCache = await this.sessionService.validateSession(
      decoded.sessionId,
    );
    if (!sessionCache) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // Look up user for fresh claims
    const user = await this.prisma.unscoped.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, firmId: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is no longer active');
    }

    // Sign new tokens
    const newAccessToken = this.signAccessToken({
      sub: user.id,
      firmId: user.firmId,
      role: user.role as UserRole,
      email: user.email,
      sessionId: decoded.sessionId,
    });

    const newRefreshToken = this.signRefreshToken({
      sub: user.id,
      sessionId: decoded.sessionId,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * POST /auth/logout
   *
   * Delete the current session from PostgreSQL + Redis.
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.deleteSession(sessionId);
    this.logger.log(`Session ${sessionId} logged out`);
  }

  /**
   * GET /auth/me
   *
   * Return the current user's profile.
   */
  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.unscoped.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        firm: { select: { name: true } },
      },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      firmId: user.firmId,
      firmName: user.firm.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      whatsappNumber: user.whatsappNumber,
      notificationPreferences:
        user.notificationPreferences as Record<string, unknown>,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * POST /auth/change-password
   *
   * 1. Verify current password
   * 2. Hash new password
   * 3. Update in DB
   * 4. Delete ALL sessions for this user (force re-login everywhere)
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.unscoped.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const newHash = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONSTANTS.BCRYPT_ROUNDS,
    );

    await this.prisma.unscoped.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Invalidate ALL sessions -- user must log in again with new password
    await this.sessionService.deleteAllUserSessions(userId);

    this.logger.log(
      `Password changed for user ${userId} -- all sessions revoked`,
    );
  }

  // --- Private helpers ---

  /**
   * Sign a short-lived access token (15 minutes).
   */
  private signAccessToken(payload: Omit<JwtPayload, 'iat'>): string {
    return this.jwtService.sign(
      { ...payload },
      {
        expiresIn: '1d',
        issuer: this.configService.get<string>('JWT_ISSUER', 'ca-practice-os'),
      },
    );
  }

  /**
   * Sign a longer-lived refresh token (7 days).
   */
  private signRefreshToken(payload: {
    sub: string;
    sessionId: string;
  }): string {
    return this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        expiresIn: `${AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS}d`,
        issuer: this.configService.get<string>('JWT_ISSUER', 'ca-practice-os'),
      },
    );
  }

  /**
   * Check if the account is locked due to too many failed login attempts.
   */
  private async checkAccountLockout(email: string): Promise<void> {
    const lockoutKey = `${AUTH_CONSTANTS.LOCKOUT_PREFIX}${email}`;
    const isLocked = await this.redisService.exists(lockoutKey);

    if (isLocked) {
      const ttl = await this.redisService.ttl(lockoutKey);
      throw new UnauthorizedException(
        `Account is temporarily locked. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      );
    }
  }

  /**
   * Record a failed login attempt. Lock the account after LOCKOUT_THRESHOLD.
   */
  private async recordFailedAttempt(email: string): Promise<void> {
    const attemptsKey = `${AUTH_CONSTANTS.LOGIN_ATTEMPTS_PREFIX}${email}`;
    const attempts = await this.redisService.incr(attemptsKey);

    // Set TTL on first attempt
    if (attempts === 1) {
      await this.redisService.expire(
        attemptsKey,
        AUTH_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60,
      );
    }

    if (attempts >= AUTH_CONSTANTS.LOCKOUT_THRESHOLD) {
      // Lock the account
      const lockoutKey = `${AUTH_CONSTANTS.LOCKOUT_PREFIX}${email}`;
      await this.redisService.set(
        lockoutKey,
        '1',
        AUTH_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60,
      );

      // Clear the attempts counter
      await this.redisService.del(attemptsKey);

      this.logger.warn(
        `Account locked for ${email} after ${attempts} failed attempts`,
      );
    }
  }

  /**
   * Clear failed login attempts (called on successful login).
   */
  private async clearFailedAttempts(email: string): Promise<void> {
    const attemptsKey = `${AUTH_CONSTANTS.LOGIN_ATTEMPTS_PREFIX}${email}`;
    await this.redisService.del(attemptsKey);
  }
}
