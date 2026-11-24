/**
 * Pruebas del simulador del armado (SDD 2026-10-26-multipedido-armado-ronda, con sus deltas del servicio en
 * specs-servicio/, y 2026-11-20-multipedido-configuracion-armado). Una prueba por escenario: cada preset de
 * `armadoEscenarios.ts` declara lo que el spec espera y `verificarPreset` lo compara.
 *
 * Correr con: node --import ./tests/domain/loader.mjs --test tests/domain/armado.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { armarRonda, CONFIG_INICIAL, ordenarCola } from '../../src/domain/armado.ts';
import { PRESETS_ARMADO, verificarPreset } from '../../src/domain/armadoEscenarios.ts';

test('hay un preset por cada escenario del armado y de la configuración en la foto de las specs, sin ids repetidos', () => {
  const foto = JSON.parse(fs.readFileSync(new URL('../alineacion/escenarios-spec.json', import.meta.url), 'utf8'));
  const clave = (cambio, capacidad, requisito, escenario) => `${cambio} · ${capacidad} · ${requisito} · ${escenario}`;
  const enSpec = foto.escenarios
    .filter((e) => e.cambio === 'armado' || e.cambio === 'configuracion')
    .map((e) => clave(e.cambio, e.capacidad, e.requisito, e.escenario))
    .sort();
  const enDemo = PRESETS_ARMADO.map((p) => clave(p.cambio ?? 'armado', p.capacidad, p.requisito, p.escenario)).sort();
  assert.deepEqual(enDemo, enSpec);
  assert.equal(new Set(PRESETS_ARMADO.map((p) => p.id)).size, PRESETS_ARMADO.length);
});

for (const p of PRESETS_ARMADO) {
  if (p.enListado) {
    test(`${p.requisito} · ${p.escenario} — se valida en el listado de la HH`, () => {
      assert.equal(p.cola.length, 0);
    });
    continue;
  }
  test(`${p.requisito} · ${p.escenario}`, () => {
    assert.ok(Object.keys(p.comprobar).length > 0, 'el preset debe declarar qué comprobar');
    assert.deepEqual(verificarPreset(p), []);
  });
}

test('la zona no cambia el orden: sin desempates, manda el folio', () => {
  const base = { orden: 1, creado: '2026-11-09 08:00', codigos: ['0486600'], servicio: 'local', tipo: 'cliente', direccion: 'X', minutos: 5 };
  const orden = ordenarCola([
    { ...base, folio: 3, zona: 'Z1' },
    { ...base, folio: 1, zona: 'Z9' },
    { ...base, folio: 2, zona: 'Z1' },
  ]).map((p) => p.folio);
  assert.deepEqual(orden, [1, 2, 3]);
});

test('cola vacía: no hay ancla ni ronda', () => {
  const r = armarRonda([], CONFIG_INICIAL);
  assert.equal(r.ancla, null);
  assert.deepEqual(r.ronda, []);
});

test('precondición: en la ruta SP el multipedido V2 no interviene aunque la bandera esté activa', () => {
  const base = { creado: '2026-11-09 08:00', codigos: ['0486600'], servicio: 'local', tipo: 'cliente', direccion: 'X', minutos: 5 };
  const cola = [{ ...base, folio: 1, orden: 1 }, { ...base, folio: 2, orden: 2 }];
  assert.equal(armarRonda(cola, CONFIG_INICIAL).modo, 'multipedido');
  const r = armarRonda(cola, { ...CONFIG_INICIAL, RondaOrdenesSurtidoAPI: false });
  assert.equal(r.modo, 'actual');
  assert.equal(r.ruta, 'sp');
  assert.deepEqual(r.evaluados, []);
});

test('Bandera_RevisionPedidoEnHH no participa en el armado (clarificación 48)', () => {
  const base = { creado: '2026-11-09 08:00', codigos: ['0486600'], servicio: 'local', tipo: 'cliente', direccion: 'X', minutos: 5 };
  const cola = [{ ...base, folio: 1, orden: 1 }, { ...base, folio: 2, orden: 2 }];
  const r = armarRonda(cola, { ...CONFIG_INICIAL, Bandera_RevisionPedidoEnHH: true });
  assert.deepEqual(r.ronda.map((p) => p.folio), [1, 2]);
});
