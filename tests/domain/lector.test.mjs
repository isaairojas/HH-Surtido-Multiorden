/**
 * Pruebas del lector y de las reglas que la demo añadió el 2026-11-09 para cubrir los escenarios de QA:
 * producto negado, sobrante, sacar un pedido, letras de contenedor, tarea sin avance, orden del cierre y familias.
 * La etiqueta única y la voz se prueban, con los datos de la spec, en escenarios.test.mjs (desde 2026-11-11).
 *
 * Correr con: npm run test:domain
 */
import test from 'node:test';
import { RONDA_PRUEBAS } from './ronda-pruebas.ts';
import assert from 'node:assert/strict';

import { etiqueta, leerCodigo, limpiarLectura } from '../../src/domain/codigos.ts';
import { interpretarLectura } from '../../src/domain/lector.ts';
import {
  cambioDePedido,
  estadoInicial,
  evaluarCantidadDetalle,
  ordenarPorFamilia,
  productosVista,
  rondaReducer,
  tareaSinAvance,
} from '../../src/domain/ronda.ts';

const surtir = (s, codigo, cantidad) => rondaReducer(s, { type: 'surtirPorCodigo', codigo, cantidad });
const partida = (s, pedidoId, codigo) => s.ronda.pedidos.find((p) => p.id === pedidoId).partidas.find((x) => x.codigo === codigo);

/* ---- Lector ---- */

test('el lector conserva solo dígitos, "-", "F" y "C", hasta 100 caracteres', () => {
  assert.equal(limpiarLectura('0607006-F00001 ñ#x'), '0607006-F00001');
  assert.equal(limpiarLectura('1'.repeat(150)).length, 100);
});

test('sin QR en la demo, una lectura con "-F" no es código ni etiqueta', () => {
  assert.equal(leerCodigo('0607006-F00001').tipo, 'invalido');
});

test('un código negado que ya nadie necesita se rechaza como "Producto negado"', () => {
  const s = rondaReducer(estadoInicial(RONDA_PRUEBAS), { type: 'negar', codigo: '6200404', motivo: 'Sin existencia' });
  assert.deepEqual(interpretarLectura(s, '6200404'), { tipo: 'rechazo', codigo: '6200404', rechazo: 'producto-negado' });
});

test('un código que no está en la ronda se rechaza como "Código inválido"', () => {
  assert.equal(interpretarLectura(estadoInicial(RONDA_PRUEBAS), '9999999').rechazo, 'fuera-de-ronda');
});

test('sobrante: el código ya surtido pide la cantidad y con etiqueta se rechaza por mayor a la solicitada', () => {
  // 1458000 (misceláneo) solo está en 100001; 0607006 (escaneable) también.
  let s = surtir(estadoInicial(RONDA_PRUEBAS), '1458000', 2);
  assert.deepEqual(interpretarLectura(s, '1458000'), { tipo: 'capturar', codigo: '1458000' });
  s = surtir(s, '0607006', 2);
  assert.deepEqual(interpretarLectura(s, etiqueta('0607006', 1)), { tipo: 'rechazo', codigo: '0607006', rechazo: 'excede-solicitado' });
});

test('los misceláneos siempre piden la cantidad, aunque se lea una etiqueta de 18 dígitos', () => {
  assert.deepEqual(interpretarLectura(estadoInicial(RONDA_PRUEBAS), etiqueta('1394010', 3)), { tipo: 'capturar', codigo: '1394010' });
});

test('el escaneable surte directo con la cantidad de su etiqueta', () => {
  assert.deepEqual(interpretarLectura(estadoInicial(RONDA_PRUEBAS), etiqueta('0607006', 1)), { tipo: 'surtir', codigo: '0607006', cantidad: 1 });
});

/* ---- Sacar el pedido de la ronda y letras de contenedor ---- */

test('cargar sustituye el estado y la tarea sin avance no trae piezas ni negaciones', () => {
  let s = surtir(estadoInicial(RONDA_PRUEBAS), '0607006', 1);
  s = rondaReducer(s, { type: 'negar', codigo: '1458000', motivo: 'Producto dañado' });
  const limpia = tareaSinAvance(s);
  assert.ok(limpia.ronda.pedidos.every((p) => p.partidas.every((x) => x.surtido === 0 && x.motivoNegacion === null)));
  assert.deepEqual(rondaReducer(s, { type: 'cargar', estado: limpia }), limpia);
});

/* ---- Finalizar ---- */

/* ---- Familia ---- */

test('dentro de una familia los códigos van de menor a mayor', () => {
  const v = ordenarPorFamilia(productosVista(estadoInicial(RONDA_PRUEBAS).ronda));
  assert.deepEqual(v.filter((x) => x.familia === 'Foco').map((x) => x.codigo), ['1978000', '2010000', '2012000']);
});

test('los códigos sin familia van juntos al final, de menor a mayor', () => {
  const s = estadoInicial(RONDA_PRUEBAS);
  const pedidos = s.ronda.pedidos.map((p) => ({
    ...p,
    partidas: p.partidas.map((x) => (x.codigo === '1458000' || x.codigo === '2010000' ? { ...x, familia: '' } : x)),
  }));
  const v = ordenarPorFamilia(productosVista({ ...s.ronda, pedidos }));
  assert.deepEqual(v.slice(-2).map((x) => x.codigo), ['1458000', '2010000']);
});

/* ---- Cantidad surtida del detalle, como el V2 (clarify 28) ---- */

test('el detalle valida la cantidad como hoy: cero, mayor a la solicitada y mayor a la existencia', () => {
  const s = estadoInicial(RONDA_PRUEBAS);
  const cinta = partida(s, '100001', '1394010'); // 11 solicitadas, 31 en existencia
  assert.equal(evaluarCantidadDetalle(cinta, 0), 'cantidad-cero');
  assert.equal(evaluarCantidadDetalle(cinta, 12), 'excede-solicitado');
  assert.equal(evaluarCantidadDetalle(partida(s, '100002', '6200404'), 2), 'excede-existencia');
  assert.equal(evaluarCantidadDetalle(cinta, 5), null);
});

test('fijar la cantidad cambia solo el pedido indicado y una inválida no cambia nada', () => {
  let s = surtir(estadoInicial(RONDA_PRUEBAS), '1394010', 3);
  s = rondaReducer(s, { type: 'fijarCantidad', codigo: '1394010', pedidoId: '100001', cantidad: 7 });
  assert.equal(partida(s, '100001', '1394010').surtido, 7);
  assert.equal(partida(s, '100002', '1394010').surtido, 0);
  assert.deepEqual(rondaReducer(s, { type: 'fijarCantidad', codigo: '1394010', pedidoId: '100001', cantidad: 0 }), s);
  assert.deepEqual(rondaReducer(s, { type: 'fijarCantidad', codigo: '1394010', pedidoId: '100001', cantidad: 12 }), s);
});

test('al llegar a lo solicitado desde el detalle, las siguientes piezas van al siguiente pedido', () => {
  const s = surtir(estadoInicial(RONDA_PRUEBAS), '1394010', 3);
  const sig = rondaReducer(s, { type: 'fijarCantidad', codigo: '1394010', pedidoId: '100001', cantidad: 11 });
  const c = cambioDePedido(s.ronda, sig.ronda, '1394010');
  assert.equal(c?.desde.id, '100001');
  assert.equal(c?.hacia.id, '100002');
  assert.equal(surtir(sig, '1394010', 1).ronda.pedidos[1].partidas[0].surtido, 1);
});
