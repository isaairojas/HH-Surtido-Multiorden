import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages sirve el proyecto en https://isaairojas.github.io/HH-Surtido-Multiorden/
// El base se aplica en el build (npm run build); en dev queda en "/".
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/HH-Surtido-Multiorden/' : '/',
  resolve: {
    alias: {
      '@ds': fileURLToPath(new URL('./src/design-system', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    },
  },
  server: { port: 5181 },
}));
