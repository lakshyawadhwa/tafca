import { ComplianceEntryStatus } from '../enums/compliance-entry-status.enum.js';

/**
 * Allowed status transitions for a compliance calendar entry.
 * Mirrors the TASK_STATUS_TRANSITIONS pattern: the service validates a
 * requested status against the current status and returns the allowed list
 * on rejection.
 *
 * Late filing is a normal reality for CA firms, so MISSED -> FILED and
 * FILED -> IN_PROGRESS (revert a mistaken mark) are both permitted.
 */
export const COMPLIANCE_ENTRY_TRANSITIONS: Record<
  ComplianceEntryStatus,
  ComplianceEntryStatus[]
> = {
  [ComplianceEntryStatus.PENDING]: [
    ComplianceEntryStatus.IN_PROGRESS,
    ComplianceEntryStatus.FILED,
    ComplianceEntryStatus.NOT_APPLICABLE,
    ComplianceEntryStatus.MISSED,
  ],
  [ComplianceEntryStatus.IN_PROGRESS]: [
    ComplianceEntryStatus.FILED,
    ComplianceEntryStatus.PENDING,
    ComplianceEntryStatus.MISSED,
  ],
  [ComplianceEntryStatus.MISSED]: [
    ComplianceEntryStatus.FILED,
    ComplianceEntryStatus.IN_PROGRESS,
  ],
  [ComplianceEntryStatus.NOT_APPLICABLE]: [ComplianceEntryStatus.PENDING],
  [ComplianceEntryStatus.FILED]: [ComplianceEntryStatus.IN_PROGRESS],
};
