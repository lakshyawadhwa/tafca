import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @IsOptional()
  @IsNumberString()
  REDIS_PORT?: string;

  @IsOptional()
  @IsNumberString()
  APP_PORT?: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ISSUER?: string;

  @IsIn(['development', 'production', 'test'])
  NODE_ENV!: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'unknown error';
        return `  - ${error.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(
      `Environment validation failed:\n${messages}\n\nCheck your .env file or environment variables.`,
    );
  }

  return validatedConfig;
}
