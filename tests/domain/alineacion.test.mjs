/**
 * Alineación demo ↔ specs. La verdad vive en el `sdd/` de exodus-gtm-pwa (principio 5); la demo la sigue.
 * `tests/alineacion/escenarios-spec.json` es la foto de esas specs (se regenera con `npm run specs:foto`).
 *
 * - Cada caso del catálogo nombra un requisito y un escenario que existen en la spec, con el nombre exacto.
 * - Cada escenario de la spec tiene caso en la demo, o está en `pendientes.json` con el motivo.
 * - `pendientes.json` solo baja: un pendiente que ya tiene caso hace fallar la prueba hasta quitarlo.
 *
 * Correr con: npm run test:domain
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CASOS } from '../../src/navigation/catalogo.ts';

const leer = (archivo) => JSON.parse(fs.readFileSync(new URL(`../alineacion/${archivo}`, import.meta.url), 'utf8'));
const foto = leer('escenarios-spec.json');
const pendientes = leer('pendientes.json');

const clave = (x) => `${x.cambio} · ${x.requisito} · ${x.escenario}`;
const enSpec = new Set(foto.escenarios.map(clave));
const enDemo = new Set(CASOS.map(clave));
const faltan = new Set(pendientes.faltan.map((p) => clave(p)));
const desalineados = new Set(pendientes.desalineados.map((p) => clave(p)));

test('cada caso de la demo nombra un escenario que existe en la spec', () => {
  const sueltos = CASOS.filter((x) => !enSpec.has(clave(x)) && !desalineados.has(clave(x))).map(clave);
  assert.deepEqual(sueltos, [], 'Casos con requisito o escenario que no están en la spec (¿se renombró? corre `npm run specs:foto`)');
});

test('cada escenario de la spec tiene caso en la demo o está pendiente con su motivo', () => {
  const sinCaso = foto.escenarios.filter((x) => !enDemo.has(clave(x)) && !faltan.has(clave(x))).map(clave);
  assert.deepEqual(sinCaso, [], 'Escenarios de la spec sin caso en la demo');
});

test('los pendientes no están ya resueltos', () => {
  const resueltos = [
    ...pendientes.faltan.filter((p) => enDemo.has(clave(p))),
    ...pendientes.desalineados.filter((p) => enSpec.has(clave(p)) || !enDemo.has(clave(p))),
  ].map(clave);
  assert.deepEqual(resueltos, [], 'Quita de pendientes.json lo que ya está alineado');
  for (const p of [...pendientes.faltan, ...pendientes.desalineados]) assert.ok(p.motivo, `Pendiente sin motivo: ${clave(p)}`);
});

test('ningún caso es "regla" si su nombre ya es un escenario de la spec', () => {
  const reglas = CASOS.filter((x) => x.extra && enSpec.has(clave(x))).map(clave);
  assert.deepEqual(reglas, [], 'Quita `extra: true`: ya tienen Scenario en la spec');
});
