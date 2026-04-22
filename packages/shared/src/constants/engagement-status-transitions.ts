import { EngagementStatus } from '../enums/engagement-status.enum.js';

export const ENGAGEMENT_STATUS_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  [EngagementStatus.ACTIVE]: [EngagementStatus.ON_HOLD, EngagementStatus.COMPLETED, EngagementStatus.CANCELLED],
  [EngagementStatus.ON_HOLD]: [EngagementStatus.ACTIVE, EngagementStatus.CANCELLED],
  [EngagementStatus.COMPLETED]: [],
  [EngagementStatus.CANCELLED]: [],
};
