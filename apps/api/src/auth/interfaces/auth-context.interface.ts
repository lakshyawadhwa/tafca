import { UserRole } from '@ca-practice-os/shared';

/**
 * Stored in AsyncLocalStorage. Available everywhere via request context.
 * Set by JwtAuthGuard after successful validation.
 */
export interface AuthContext {
  userId: string;
  firmId: string;
  role: UserRole;
  sessionId: string;
}
