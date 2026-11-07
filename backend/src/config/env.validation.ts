// Needed for type conversion: this module can be loaded before Nest (e.g. by the Jest setup file).
import 'reflect-metadata';
import { resolve } from 'path';
import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** The single .env file lives in the task folder (shared with the backend scripts and the frontend). */
export const ROOT_ENV_FILE = resolve(__dirname, '..', '..', '..', '.env');

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsOptional()
  @IsString()
  DB_NAME_TEST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT: number;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string;

  @IsString()
  @MinLength(16)
  JWT_SECRET: string;

  @Matches(/^\d+[smhd]?$/, { message: 'JWT_EXPIRES_IN must look like 8h, 30m or 3600' })
  JWT_EXPIRES_IN: string;

  @IsInt()
  @Min(0)
  @Max(3600)
  HOLD_SWEEP_INTERVAL_SECONDS: number;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env);
  if (errors.length > 0) {
    const problems = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new Error(`Invalid environment configuration:\n- ${problems.join('\n- ')}`);
  }
  return env;
}
