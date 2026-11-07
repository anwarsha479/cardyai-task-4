import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { ROOT_ENV_FILE } from '../../src/config/env.validation';
import { buildDataSourceOptions, DbConnectionEnv } from '../../src/database/data-source';

/** Creates the test database if needed and applies all migrations once per e2e run. */
export default async function globalSetup(): Promise<void> {
  loadDotenv({ path: ROOT_ENV_FILE });
  const env = process.env as unknown as DbConnectionEnv & { DB_NAME: string; DB_NAME_TEST?: string };
  const testDb = env.DB_NAME_TEST;
  if (!testDb || !/^[A-Za-z0-9_]+$/.test(testDb)) {
    throw new Error('DB_NAME_TEST must be set in the root .env (letters, digits, underscore)');
  }
  if (testDb === env.DB_NAME) {
    throw new Error('DB_NAME_TEST must differ from DB_NAME: e2e tests truncate every table');
  }

  const admin = new DataSource({ ...buildDataSourceOptions(env, env.DB_NAME), migrations: [] });
  try {
    await admin.initialize();
  } catch (error) {
    throw new Error(
      `Cannot reach PostgreSQL at ${env.DB_HOST}:${env.DB_PORT}. Check that the server is running and that DB_NAME exists. (${String(error)})`,
    );
  }
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDb]);
  if (existing.length === 0) {
    await admin.query(`CREATE DATABASE "${testDb}"`);
  }
  await admin.destroy();

  const test = new DataSource(buildDataSourceOptions(env, testDb));
  await test.initialize();
  await test.runMigrations();
  await test.destroy();
}
