import { config as loadDotenv } from 'dotenv';
import { ROOT_ENV_FILE } from '../../src/config/env.validation';

// Runs before every e2e test file: point the app at the test database.
loadDotenv({ path: ROOT_ENV_FILE });
if (!process.env.DB_NAME_TEST) {
  throw new Error('DB_NAME_TEST must be set in the root .env to run e2e tests');
}
process.env.DB_NAME = process.env.DB_NAME_TEST;
// The e2e tests run the expiry job themselves, at fixed clock times.
process.env.HOLD_SWEEP_INTERVAL_SECONDS = '0';
