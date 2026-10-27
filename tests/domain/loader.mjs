/**
 * Hook de resolución para correr el dominio en Node.
 *
 * El proyecto usa `moduleResolution: "bundler"`, así que resuelve dos cosas que Node
 * no sabe hacer por su cuenta:
 * - Importaciones de imágenes (`@assets/productos/*.png`), que Vite convierte en URLs:
 *   aquí se sustituyen por un módulo trivial.
 * - Importaciones relativas sin extensión (`../mocks/ronda`): se les añade `.ts`.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ESTATICOS = ['.png', '.jpg', '.svg', '.css'];
const STUB = { url: 'data:text/javascript,export default "stub"', shortCircuit: true };

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (ESTATICOS.some((ext) => especificador.endsWith(ext))) return STUB;
    if (especificador.startsWith('@assets/') || especificador.startsWith('@ds/')) return STUB;

    if (especificador.startsWith('.')) {
      const resuelto = new URL(especificador, contexto.parentURL);
      if (!existsSync(fileURLToPath(resuelto))) {
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          const candidato = new URL(especificador + ext, contexto.parentURL);
          if (existsSync(fileURLToPath(candidato))) return { url: candidato.href, shortCircuit: true };
        }
      }
    }
    return siguiente(especificador, contexto);
  },
});
