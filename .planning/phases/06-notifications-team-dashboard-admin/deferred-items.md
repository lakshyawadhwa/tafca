# Deferred Items - Phase 06

## Pre-existing Issues

1. ~~**Dashboard module TypeScript errors** — Fixed in 06-02 Task 1.~~

2. **Team service TypeScript error** (`apps/api/src/team/team.service.ts:204`) - `ApprovalQueueItemDto.priority` typed as shared `TaskPriority` enum but Prisma returns `$Enums.TaskPriority`. Type mismatch between Prisma generated enums and shared package enums. From 06-01 execution. Not caused by 06-02 changes.
