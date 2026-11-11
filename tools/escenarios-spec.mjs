/**
 * Foto de los escenarios de las specs que la demo representa, tomada del `sdd/` de exodus-gtm-pwa (la fuente
 * de verdad, principio 5). La guarda en `tests/alineacion/escenarios-spec.json`, que lee la prueba
 * `tests/domain/alineacion.test.mjs`.
 *
 * Solo copia nombres (cambio, capacidad, requisito y escenario), los mismos que ya muestra el catálogo de la
 * demo. Los GIVEN/WHEN/THEN se quedan en exodus-gtm-pwa.
 *
 * Uso (después de cada pull de exodus-gtm-pwa que toque estas specs):
 *   npm run specs:foto -- "<ruta a exodus-gtm-pwa>"
 * Sin ruta usa la variable EXODUS_GTM_PWA o, si no existe, la carpeta hermana del equipo
 * (`../HH - GTM/HH - Prod/exodus-gtm-pwa`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(
  process.argv[2] ?? process.env.EXODUS_GTM_PWA ?? path.join(raiz, '..', 'HH - GTM', 'HH - Prod', 'exodus-gtm-pwa'),
);

/** Cambios que la demo representa, con el id corto que usa el catálogo. */
const CAMBIOS = {
  'listado': '2026-10-26-multipedido-surtido-listado',
  'cierre': '2026-11-05-multipedido-surtido-listado-cierre',
  'imagen-familia': '2026-10-26-surtido-listado-imagen-familia',
  'armado': '2026-10-26-multipedido-armado-ronda',
};

const escenarios = [];
for (const [cambio, carpeta] of Object.entries(CAMBIOS)) {
  const dir = path.join(repo, 'sdd', 'changes', carpeta, 'specs');
  if (!fs.existsSync(dir)) {
    console.error(`No encuentro ${dir}. Pasa la ruta de exodus-gtm-pwa como argumento.`);
    process.exit(1);
  }
  for (const capacidad of fs.readdirSync(dir).sort()) {
    const archivo = path.join(dir, capacidad, 'spec.md');
    if (!fs.existsSync(archivo)) continue;
    let requisito = null;
    for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      let m;
      if ((m = linea.match(/^### Requirement: (.+)/))) requisito = m[1].trim();
      if ((m = linea.match(/^#### Scenario: (.+)/))) escenarios.push({ cambio, capacidad, requisito, escenario: m[1].trim() });
    }
  }
}

let commit = null;
try {
  commit = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%h %cs %s', '--', 'sdd/changes'], { encoding: 'utf8' }).trim();
} catch {
  /* sin git: la foto se guarda sin commit de origen */
}

const salida = path.join(raiz, 'tests', 'alineacion', 'escenarios-spec.json');
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify({ origen: { repositorio: 'exodus-gtm-pwa', commit }, cambios: CAMBIOS, escenarios }, null, 2) + '\n');
console.log(`${escenarios.length} escenarios de ${Object.keys(CAMBIOS).length} cambios → ${path.relative(raiz, salida)}${commit ? ` (exodus-gtm-pwa ${commit})` : ''}`);
