import { UserRole } from '@ca-practice-os/shared';

/**
 * The shape of data stored inside the JWT.
 * This is what JwtStrategy.validate() receives after signature verification.
 */
export interface JwtPayload {
  sub: string;       // userId
  firmId: string;
  role: UserRole;
  email: string;
  sessionId: string;
  iat: number;
}
