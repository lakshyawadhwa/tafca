/**
 * Computed workload status per user.
 * NOT a Prisma enum -- this is display-only, derived from open task counts
 * relative to the firm average.
 *
 * Thresholds:
 * - UNDERUTILISED: < 0.5x firm average
 * - BALANCED: 0.5x - 1.5x firm average
 * - OVERLOADED: > 1.5x firm average
 */
export type WorkloadStatus = 'UNDERUTILISED' | 'BALANCED' | 'OVERLOADED';
