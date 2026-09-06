import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiDevServerPlugin } from './vite-api-dev.js';

export default defineConfig({
  plugins: [react(), apiDevServerPlugin()],
  server: {
    port: 3000,
    open: false
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']
  }
});
