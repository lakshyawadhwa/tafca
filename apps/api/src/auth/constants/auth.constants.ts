export const AUTH_CONSTANTS = {
  /** Safety-net JWT expiry. Real revocation is session deletion. */
  JWT_EXPIRY: '365d',

  /** Redis key prefix for sessions */
  SESSION_PREFIX: 'session:',

  /** Redis TTL for session cache (in seconds). Matches JWT_EXPIRY. */
  SESSION_CACHE_TTL: 365 * 24 * 60 * 60, // 31,536,000 seconds

  /** Maximum concurrent sessions per user */
  MAX_SESSIONS_PER_USER: 5,

  /** bcrypt cost factor */
  BCRYPT_ROUNDS: 12,

  /** Rate limit: max login attempts per IP per minute */
  LOGIN_RATE_LIMIT_MAX: 5,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,

  /** Rate limit: max register attempts per IP per minute */
  REGISTER_RATE_LIMIT_MAX: 3,
  REGISTER_RATE_LIMIT_WINDOW_SECONDS: 60,

  /** Account lockout: failed attempts before lockout */
  LOCKOUT_THRESHOLD: 10,

  /** Account lockout duration in minutes */
  LOCKOUT_DURATION_MINUTES: 30,

  /** Redis key prefix for failed login attempts */
  LOGIN_ATTEMPTS_PREFIX: 'login_attempts:',

  /** Redis key prefix for account lockout */
  LOCKOUT_PREFIX: 'lockout:',

  /** Refresh token cookie name */
  REFRESH_TOKEN_COOKIE_NAME: 'refresh_token',

  /** Refresh token expiry in days */
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
} as const;
