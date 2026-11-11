/**
 * Pruebas del simulador del armado de la ronda multipedido V2 (SDD 2026-10-26-multipedido-armado-ronda).
 * Una prueba por escenario de los specs `elegibilidad-ronda-multipedido` y `catalogo-bandera-sucursal`:
 * cada preset de `armadoEscenarios.ts` declara lo que el spec espera y `verificarPreset` lo compara.
 *
 * Correr con: node --import ./tests/domain/loader.mjs --test tests/domain/armado.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { armarRonda, CONFIG_INICIAL, ordenarCola } from '../../src/domain/armado.ts';
import { PRESETS_ARMADO, verificarPreset } from '../../src/domain/armadoEscenarios.ts';

test('hay un preset por cada uno de los 46 escenarios de los dos specs, sin ids repetidos', () => {
  assert.equal(PRESETS_ARMADO.length, 46);
  assert.equal(PRESETS_ARMADO.filter((p) => p.capacidad === 'elegibilidad-ronda-multipedido').length, 40);
  assert.equal(PRESETS_ARMADO.filter((p) => p.capacidad === 'catalogo-bandera-sucursal').length, 6);
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
  const base = { vence: '12:00', creado: '2026-11-09 08:00', codigos: ['0486600'], servicio: 'local', tipo: 'cliente', direccion: 'X', minutos: 5 };
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
