import { UserRole } from '@ca-practice-os/shared';

/**
 * Shape of session data stored in Redis.
 * Key: session:{sessionId}
 * TTL: 365 days (matches JWT safety-net expiry)
 */
export interface SessionCache {
  userId: string;
  firmId: string;
  role: UserRole;
  expiresAt: string; // ISO 8601
}
