/**
 * Alineación demo ↔ specs. La verdad vive en el `sdd/` de exodus-gtm-pwa (principio 5); la demo la sigue.
 * `tests/alineacion/escenarios-spec.json` es la foto de esas specs (se regenera con `npm run specs:foto`).
 * La finalización del surtido (`tests/alineacion/alcance-revision.json`) está en la demo de revisión multipedido
 * (https://github.com/isaairojas/Revisi-n-multipedido): esos escenarios no llevan caso aquí.
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
const alcance = leer('alcance-revision.json');
const pendientes = leer('pendientes.json');

const clave = (x) => `${x.cambio} · ${x.requisito} · ${x.escenario}`;
const enRevisionEsc = new Set(alcance.escenarios.map(clave));
const enRevision = (x) => alcance.requisitos.some((r) => r.cambio === x.cambio && r.requisito === x.requisito) || enRevisionEsc.has(clave(x));
const todos = leer('escenarios-spec.json').escenarios;
const foto = { escenarios: todos.filter((x) => !enRevision(x)) };
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

test('la finalización del surtido no tiene caso aquí: está en la demo de revisión multipedido', () => {
  const aqui = CASOS.filter(enRevision).map(clave);
  assert.deepEqual(aqui, [], 'Estos casos van en la demo de revisión multipedido (alcance-revision.json)');
  const sueltos = [
    ...alcance.requisitos.filter((r) => !todos.some((x) => x.cambio === r.cambio && x.requisito === r.requisito)).map((r) => `${r.cambio} · ${r.requisito}`),
    ...alcance.escenarios.filter((e) => !todos.some((x) => clave(x) === clave(e))).map(clave),
  ];
  assert.deepEqual(sueltos, [], 'Revisa alcance-revision.json (¿se renombró en la spec?)');
});

test('ningún caso es "regla" si su nombre ya es un escenario de la spec', () => {
  const reglas = CASOS.filter((x) => x.extra && enSpec.has(clave(x))).map(clave);
  assert.deepEqual(reglas, [], 'Quita `extra: true`: ya tienen Scenario en la spec');
});
