import { PrismaClient } from '@prisma/client';
import { getFirmId } from '../common/context/request-context';

/**
 * Models that do NOT have firm_id — they are global or scoped differently.
 * These skip automatic firm_id injection.
 */
const GLOBAL_MODELS = new Set([
  'StatutoryDeadline',
  'StatutoryDeadlineOverride',
  'Session',
]);

/**
 * Models that do NOT have a deletedAt field — skip soft-delete filtering.
 */
const MODELS_WITHOUT_SOFT_DELETE = new Set([
  'Session',
  'UserRoleHistory',
  'TaskDependency',
  'TaskActivityLog',
  'StatutoryDeadline',
  'StatutoryDeadlineOverride',
  'ComplianceCalendarEntry',
  'CredentialAccessLog',
  'UserActionLog',
  'DocumentChecklistTemplateItem',
  'DocumentChecklistInstance',
  'TaskTemplateItem',
  'Notification',
  'EngagementCustomFieldDefinition',
  'Invite',
  'FirmRolePermission',
]);

/**
 * Read operations that accept a `where` clause
 */
const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Write operations that have a `where` clause for targeting
 */
const WRITE_WITH_WHERE = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/**
 * Create operations that need firm_id injected into data
 */
const CREATE_OPERATIONS = new Set(['create', 'createMany']);

/**
 * Creates a firm-scoped Prisma client extension.
 *
 * This extension auto-injects:
 * 1. `where.firmId` on all read and write operations (for firm-scoped models)
 * 2. `where.deletedAt = null` on all read operations (for models with soft delete)
 * 3. `data.firmId` on all create operations (for firm-scoped models)
 *
 * The firm ID is read from AsyncLocalStorage via `getFirmId()`.
 * If the firm ID is empty (unauthenticated/system context), firm scoping is skipped.
 */
export function createFirmScopedClient(basePrisma: PrismaClient) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: { model: string; operation: string; args: any; query: (args: any) => Promise<any> }) {
          const modelName = model;
          const isFirmScoped = !GLOBAL_MODELS.has(modelName);
          const hasSoftDelete = !MODELS_WITHOUT_SOFT_DELETE.has(modelName);

          // Get firm ID from AsyncLocalStorage context
          let firmId = '';
          try {
            firmId = getFirmId();
          } catch {
            // No request context available (e.g., system operations, seeding)
            // Skip firm scoping
          }

          const shouldScopeFirm = isFirmScoped && firmId !== '';

          // Handle read operations — inject WHERE firm_id and deletedAt IS NULL
          if (READ_OPERATIONS.has(operation)) {
            if (!args.where) {
              args.where = {};
            }

            if (shouldScopeFirm) {
              args.where.firmId = firmId;
            }

            if (hasSoftDelete) {
              // Only add deletedAt filter if not explicitly set by the caller
              if (args.where.deletedAt === undefined) {
                args.where.deletedAt = null;
              }
            }
          }

          // Handle create operations — inject firm_id into data
          if (CREATE_OPERATIONS.has(operation) && shouldScopeFirm) {
            if (operation === 'createMany') {
              // createMany has data as array or object
              const data = (args as any).data;
              if (Array.isArray(data)) {
                (args as any).data = data.map((item: any) => ({
                  ...item,
                  firmId,
                }));
              } else if (data) {
                (args as any).data = { ...data, firmId };
              }
            } else {
              // create
              if ((args as any).data) {
                (args as any).data.firmId = firmId;
              }
            }
          }

          // Handle update/delete operations — inject WHERE firm_id
          if (WRITE_WITH_WHERE.has(operation) && shouldScopeFirm) {
            if (!args.where) {
              args.where = {};
            }
            args.where.firmId = firmId;
          }

          // Handle upsert — inject into both where and create
          if (operation === 'upsert' && shouldScopeFirm) {
            if (!args.where) {
              args.where = {};
            }
            args.where.firmId = firmId;
            if ((args as any).create) {
              (args as any).create.firmId = firmId;
            }
          }

          return query(args);
        },
      },
    },
  } as any);
}
