import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Component tests only (jsdom). The production build config stays in vite.config.js.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/components/**/*.test.jsx'],
    css: false,
  },
});
