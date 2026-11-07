import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ROOT_ENV_FILE } from '../config/env.validation';
import { CreateUsers1762500000100 } from './migrations/1762500000100-CreateUsers';
import { CreateSettings1762500000200 } from './migrations/1762500000200-CreateSettings';
import { CreateBooks1762600000300 } from './migrations/1762600000300-CreateBooks';
import { CreateLoans1762600000400 } from './migrations/1762600000400-CreateLoans';
import { CreateReservations1762600000500 } from './migrations/1762600000500-CreateReservations';
import { CreateFinePayments1762600000600 } from './migrations/1762600000600-CreateFinePayments';
import { AddBookListIndexes1762600000700 } from './migrations/1762600000700-AddBookListIndexes';

/** Migrations are listed explicitly (not globbed) so they load the same way in the app, the CLI and Jest. */
export const MIGRATIONS = [
  CreateUsers1762500000100,
  CreateSettings1762500000200,
  CreateBooks1762600000300,
  CreateLoans1762600000400,
  CreateReservations1762600000500,
  CreateFinePayments1762600000600,
  AddBookListIndexes1762600000700,
];

export interface DbConnectionEnv {
  DB_HOST: string;
  DB_PORT: number | string;
  DB_USER: string;
  DB_PASSWORD: string;
}

export function buildDataSourceOptions(env: DbConnectionEnv, database: string): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database,
    synchronize: false,
    migrations: MIGRATIONS,
  };
}

// Used by the TypeORM CLI (npm run migration:run / migration:revert).
loadDotenv({ path: ROOT_ENV_FILE });
const env = process.env as unknown as DbConnectionEnv & { DB_NAME: string };
export default new DataSource(buildDataSourceOptions(env, env.DB_NAME));
