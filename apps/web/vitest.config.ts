import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Refleja el alias "@/*" -> "./*" ya definido en tsconfig.json, que Next.js
    // resuelve nativamente pero Vitest/Vite no sin esto.
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
