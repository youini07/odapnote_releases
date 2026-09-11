import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './', // Electron 호환을 위한 상대 경로
  server: {
    port: 5177,
    strictPort: true,
    watch: {
      ignored: ['**/data/**', '**/문제집이미지/**', '**/*.json']
    }
  },
  build: {
    minify: 'esbuild'
  }
});
