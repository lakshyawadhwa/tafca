import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getFirmId, getUserId } from '../context/request-context';

/**
 * Abstract base class for all domain services that operate on firm-scoped data.
 *
 * Provides:
 * - `this.prisma` — firm-scoped Prisma client (auto-injects firm_id)
 * - `this.unscopedPrisma` — raw Prisma client for system operations
 * - `this.getFirmId()` — current firm ID from request context
 * - `this.getUserId()` — current user ID from request context
 */
@Injectable()
export abstract class FirmScopedService {
  constructor(protected readonly prismaService: PrismaService) {}

  /**
   * Firm-scoped Prisma client. All queries through this client
   * automatically include WHERE firm_id = <current firm> and
   * WHERE deleted_at IS NULL (soft delete filter).
   */
  protected get prisma() {
    return this.prismaService.scoped;
  }

  /**
   * Raw Prisma client without firm scoping.
   * Use for cross-firm operations, system queries, or when
   * you need to bypass automatic firm filtering.
   */
  protected get unscopedPrisma() {
    return this.prismaService.unscoped;
  }

  /**
   * Returns the firm ID of the current request from AsyncLocalStorage.
   * Throws if called outside a request context.
   */
  protected getFirmId(): string {
    return getFirmId();
  }

  /**
   * Returns the user ID of the current request from AsyncLocalStorage.
   * Throws if called outside a request context.
   */
  protected getUserId(): string {
    return getUserId();
  }
}
