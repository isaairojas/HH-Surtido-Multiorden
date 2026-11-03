import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { fileURLToPath, URL } from 'node:url';

// Rutas relativas en el build (./assets/…), como Revision-HH-v2: el mismo dist sirve en GitHub Pages
// (https://isaairojas.github.io/HH-Surtido-Multiorden/) y en githack (…/demo/index.html, para datos
// móviles). Funciona porque las pantallas viven en el hash (#/surtido) y la página es siempre la misma.
// En dev queda en "/".
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Las HH Zebra traen un navegador/WebView viejo que no lee el JS moderno (`??`, módulos ES) y
    // dejaba la página en blanco. Se genera además una copia transpilada con polyfills que solo
    // cargan los navegadores sin soporte; en la PC se sigue usando el bundle moderno.
    legacy({ targets: ['chrome >= 49', 'android >= 5'] }),
  ],
  base: command === 'build' ? './' : '/',
  resolve: {
    alias: {
      '@ds': fileURLToPath(new URL('./src/design-system', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    },
  },
  server: { port: 5181 },
  // El CSS no pasa por el plugin legacy: se baja para que `inset`, etc. salgan con equivalentes viejos.
  build: { cssTarget: 'chrome61' },
}));
