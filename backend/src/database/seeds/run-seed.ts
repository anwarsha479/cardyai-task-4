import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { SystemClock } from '../../common/clock/clock';
import { ROOT_ENV_FILE, validateEnv } from '../../config/env.validation';
import { buildDataSourceOptions } from '../data-source';
import { EXPECTED_COUNTS } from './seed-data';
import { runSeed, SEED_ENTITIES } from './seed';

/** CLI entry: npm run seed. Exits 1 with a reason on any failure; nothing is written then. */
async function main(): Promise<void> {
  loadDotenv({ path: ROOT_ENV_FILE });
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) {
    throw new Error('SEED_DEMO_PASSWORD is missing from the .env file');
  }
  const env = validateEnv(process.env);
  const dataSource = new DataSource({ ...buildDataSourceOptions(env, env.DB_NAME), entities: SEED_ENTITIES });
  try {
    await dataSource.initialize();
  } catch (error) {
    throw new Error(`Cannot connect to database "${env.DB_NAME}" at ${env.DB_HOST}:${env.DB_PORT} (${String(error)})`);
  }
  try {
    const result = await runSeed(dataSource, { clock: new SystemClock(), password });
    const c = EXPECTED_COUNTS;
    console.log(
      result.created
        ? `Seeded ${c.users} users, ${c.books} books (${c.copies} copies), ${c.loans} loans and ${c.reservations} reservations`
        : 'Seed data already present — nothing to do',
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
