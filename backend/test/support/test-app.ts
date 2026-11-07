import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app-setup';
import { CLOCK } from '../../src/common/clock/clock';
import { FixedClock } from './fixed-clock';

export const DEFAULT_TEST_NOW = '2026-03-10T12:00:00Z';

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  clock: FixedClock;
  close(): Promise<void>;
}

/**
 * Full application on the test database with a fixed clock. Every table is emptied first unless
 * `reset: false` (used to simulate a restart on the same data).
 */
export async function createTestApp(options: { now?: string; reset?: boolean } = {}): Promise<TestApp> {
  const clock = new FixedClock(options.now ?? DEFAULT_TEST_NOW);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();

  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  // Listen on a random port once, so supertest never starts its own listener per request.
  await app.listen(0);

  const dataSource = app.get(DataSource);
  if (options.reset !== false) await resetDatabase(dataSource);
  return { app, dataSource, clock, close: () => app.close() };
}

export async function resetDatabase(dataSource: DataSource): Promise<void> {
  const rows: { tablename: string }[] = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'`,
  );
  if (rows.length > 0) {
    const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
    await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }
}
