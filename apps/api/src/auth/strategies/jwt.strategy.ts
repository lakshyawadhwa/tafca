import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { SessionService } from '../../session/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // still respect the 365d safety-net
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: config.get<string>('JWT_ISSUER', 'ca-practice-os'),
    });
  }

  /**
   * Called by Passport after JWT signature is verified.
   * This is where we check if the session still exists (the kill switch).
   *
   * Returns the validated payload, which becomes `request.user`.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const session = await this.sessionService.validateSession(payload.sessionId);

    if (!session) {
      this.logger.debug(
        `Session ${payload.sessionId} not found for user ${payload.sub} -- token revoked`,
      );
      throw new UnauthorizedException('Session has been revoked');
    }

    // Return the full JWT payload -- this becomes request.user
    return payload;
  }
}
