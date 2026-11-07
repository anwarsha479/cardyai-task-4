import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The single .env lives in the task folder, shared with the backend.
const envDir = '..';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const port = Number(env.FRONTEND_PORT);
  if (!port) {
    throw new Error('FRONTEND_PORT is missing from the root .env file');
  }
  return {
    envDir,
    // The sign-in page shows the seeded demo accounts; their password is the seed's own value, not a copy.
    define: { 'import.meta.env.VITE_DEMO_PASSWORD': JSON.stringify(env.SEED_DEMO_PASSWORD ?? '') },
    plugins: [react()],
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
  };
});
