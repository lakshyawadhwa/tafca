import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createFirmScopedClient } from './prisma.extensions';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private _scopedClient: ReturnType<typeof createFirmScopedClient> | null =
    null;

  // PrismaClient wraps instances in a Proxy. Inside getters, `this` points to
  // the raw target (without the Proxy), so model delegates like `.user` are
  // missing. We capture the proxied reference in the constructor instead.
  private readonly _self: PrismaClient;

  constructor() {
    super();
    this._self = this;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Returns a firm-scoped Prisma client that auto-injects firm_id
   * on all queries using AsyncLocalStorage context.
   * Use this for all request-scoped domain operations.
   */
  get scoped() {
    if (!this._scopedClient) {
      this._scopedClient = createFirmScopedClient(this._self);
    }
    return this._scopedClient;
  }

  /**
   * Returns the raw PrismaClient without firm scoping.
   * Use this for system-level operations: seeding, migrations, auth lookups.
   */
  get unscoped(): PrismaClient {
    return this._self;
  }
}
