/**
 * Pruebas del reducer de la ronda.
 * Cubren SC-002 (asignación al pedido con menor orden), SC-003 (rechazo de códigos
 * fuera de ronda) y las validaciones de cantidad heredadas de Revision-HH-v2 (FR-018).
 *
 * Correr con: npm run test:domain
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  conteosRonda,
  estadoInicial,
  estadoPartida,
  evaluarSurtido,
  pedidoCompleto,
  partidasANegar,
  productosVista,
  productoVista,
  proximaPartidaPara,
  rondaCompleta,
  rondaReducer,
  statusProducto,
  transicionDePedido,
} from '../../src/domain/ronda.ts';

/** Partida concreta de un pedido, por posición en la ronda. */
const partida = (s, pedidoId, codigo) =>
  s.ronda.pedidos.find((p) => p.id === pedidoId).partidas.find((x) => x.codigo === codigo);

const surtir = (s, codigo, cantidad) => rondaReducer(s, { type: 'surtirPorCodigo', codigo, cantidad });

/** Completa todas las partidas de la ronda salvo las que `excepto` marque. */
function completarTodo(s, excepto = () => false) {
  const pedidos = s.ronda.pedidos.map((p) => ({
    ...p,
    partidas: p.partidas.map((x) => (excepto(x, p) ? x : { ...x, surtido: x.solicitado })),
  }));
  return { ronda: { ...s.ronda, pedidos } };
}

/* ---------------------------------------------------------------- *
 * FR-010 / SC-002 — asignación al pedido con menor orden
 * ---------------------------------------------------------------- */

test('el escaneo entra al pedido con menor orden que necesita el código', () => {
  // 0486600 vive en 100001 (11 piezas) y en 100002 (5 piezas), ambos sin avance.
  const s = surtir(estadoInicial(), '0486600', 11);
  assert.equal(partida(s, '100001', '0486600').surtido, 11);
  assert.equal(partida(s, '100002', '0486600').surtido, 0);
});

test('con el primer pedido ya completo, el escaneo pasa al siguiente', () => {
  const s = surtir(surtir(estadoInicial(), '0486600', 11), '0486600', 3);
  assert.equal(partida(s, '100001', '0486600').surtido, 11);
  assert.equal(partida(s, '100002', '0486600').surtido, 3);
});

test('proximaPartidaPara salta las partidas ya resueltas', () => {
  const s = surtir(estadoInicial(), '0486600', 11);
  const loc = proximaPartidaPara(s.ronda, '0486600');
  assert.equal(s.ronda.pedidos[loc.pedidoIdx].id, '100002');
});

/* ---------------------------------------------------------------- *
 * FR-011 / SC-003 — rechazos, sin cambio de estado
 * ---------------------------------------------------------------- */

test('un código ajeno a la ronda se rechaza sin tocar el estado', () => {
  const inicial = estadoInicial();
  const ev = evaluarSurtido(inicial.ronda, '9999999', 1);
  assert.equal(ev.ok, false);
  assert.equal(ev.rechazo, 'fuera-de-ronda');
  assert.deepEqual(surtir(inicial, '9999999', 1), inicial);
});

test('un código cuyas partidas están todas completas se rechaza igual que uno ajeno', () => {
  const lleno = completarTodo(estadoInicial());
  const ev = evaluarSurtido(lleno.ronda, '0486600', 1);
  assert.equal(ev.ok, false);
  assert.equal(ev.rechazo, 'fuera-de-ronda');
});

test('cantidad cero se rechaza', () => {
  const inicial = estadoInicial();
  assert.equal(evaluarSurtido(inicial.ronda, '0486600', 0).rechazo, 'cantidad-cero');
  assert.deepEqual(surtir(inicial, '0486600', 0), inicial);
});

test('una cantidad mayor a la solicitada se rechaza entera, sin aplicar el remanente', () => {
  // Decisión 2026-10-21: gana la regla de Revision-HH-v2 sobre el edge case de la spec.
  const inicial = estadoInicial();
  const ev = evaluarSurtido(inicial.ronda, '0486600', 12); // solicita 11 en el 100001
  assert.equal(ev.ok, false);
  assert.equal(ev.rechazo, 'excede-solicitado');
  assert.equal(partida(surtir(inicial, '0486600', 12), '100001', '0486600').surtido, 0);
});

test('una cantidad mayor a la existencia se rechaza', () => {
  // 0512300 pide 2 piezas pero solo hay 1 en existencia.
  const inicial = estadoInicial();
  const ev = evaluarSurtido(inicial.ronda, '0512300', 2);
  assert.equal(ev.ok, false);
  assert.equal(ev.rechazo, 'excede-existencia');
  // Una pieza sí entra.
  assert.equal(evaluarSurtido(inicial.ronda, '0512300', 1).ok, true);
});

/* ---------------------------------------------------------------- *
 * FR-005 / FR-006 — vista agregada por código
 * ---------------------------------------------------------------- */

test('la vista agrupa cada código una sola vez y suma los totales de la ronda', () => {
  const v = productosVista(estadoInicial().ronda);
  const codigos = v.map((x) => x.codigo);
  assert.equal(new Set(codigos).size, codigos.length, 'no debe repetirse ningún código');

  const filtro = v.find((x) => x.codigo === '0486600');
  assert.equal(filtro.presencias.length, 2);
  assert.equal(filtro.solicitadoTotal, 16); // 11 + 5
  assert.deepEqual(
    filtro.presencias.map((p) => p.pedidoId),
    ['100001', '100002'],
    'las presencias respetan el orden de picking',
  );
});

test('el orden de la lista respeta la secuencia de picking', () => {
  const codigos = productosVista(estadoInicial().ronda).map((x) => x.codigo);
  assert.equal(codigos[0], '0486600', 'primera partida del primer pedido');
  assert.ok(codigos.indexOf('1740900') > codigos.indexOf('2389475'), 'el 100002 va después del 100001');
});

test('el status consolidado sigue pendiente mientras alguna presencia lo esté', () => {
  const s = surtir(estadoInicial(), '0486600', 11); // completo en 100001, intacto en 100002
  assert.equal(statusProducto(productoVista(s.ronda, '0486600')), 'parcial');
});

test('los conteos de la ronda cuadran con el total de productos únicos', () => {
  const s = estadoInicial();
  const c = conteosRonda(s.ronda);
  const total = productosVista(s.ronda).length;
  assert.equal(c.completado + c.parcial + c.negado + c.pendientes, total);
  assert.equal(c.pendientes, total, 'una ronda sin avance tiene todo pendiente');
});

/* ---------------------------------------------------------------- *
 * FR-017 — negación (la "excepción" de la spec)
 * ---------------------------------------------------------------- */

const negar = (s, codigo, motivo = 'Sin existencia') => rondaReducer(s, { type: 'negar', codigo, motivo });

test('negar niega el pedido en proceso y todos los posteriores que piden el código', () => {
  const s = negar(estadoInicial(), '0486600');
  assert.equal(partida(s, '100001', '0486600').motivoNegacion, 'Sin existencia');
  assert.equal(partida(s, '100002', '0486600').motivoNegacion, 'Sin existencia');
  assert.equal(proximaPartidaPara(s.ronda, '0486600'), null, 'ya ningún pedido recibe el código');
});

test('negar con el primer pedido ya surtido empieza en el siguiente y respeta lo surtido', () => {
  // 1740900 pide 3 en el 100002 y 2 en el 100003: se completa el 100002.
  let s = surtir(estadoInicial(), '1740900', 3);
  s = negar(s, '1740900');
  assert.equal(estadoPartida(partida(s, '100002', '1740900')), 'completo');
  assert.equal(estadoPartida(partida(s, '100003', '1740900')), 'negado');
});

test('negar con avance parcial retira lo surtido: no existe la negación parcial', () => {
  let s = surtir(estadoInicial(), '0486600', 4);
  s = negar(s, '0486600');
  const p = partida(s, '100001', '0486600');
  assert.equal(p.surtido, 0);
  assert.equal(estadoPartida(p), 'negado');
});

test('partidasANegar lista los pedidos afectados con lo que se retira', () => {
  const s = surtir(estadoInicial(), '0486600', 4);
  const afectadas = partidasANegar(s.ronda, '0486600').map(({ pedidoId, surtido, solicitado }) => ({ pedidoId, surtido, solicitado }));
  assert.deepEqual(afectadas, [
    { pedidoId: '100001', surtido: 4, solicitado: 11 },
    { pedidoId: '100002', surtido: 0, solicitado: 5 },
  ]);
});

test('sin pedidos que necesiten el código no hay nada que negar', () => {
  const s = completarTodo(estadoInicial());
  assert.deepEqual(partidasANegar(s.ronda, '0486600'), []);
  assert.deepEqual(negar(s, '0486600'), s);
});

test('un pedido con una partida negada se considera resuelto', () => {
  // El 100002 queda completo salvo 0512300, que se niega por falta de existencia.
  let s = completarTodo(estadoInicial(), (x) => x.codigo === '0512300');
  assert.equal(pedidoCompleto(s.ronda.pedidos[1]), false);
  s = rondaReducer(s, { type: 'negar', codigo: '0512300', motivo: 'Sin existencia' });
  assert.equal(pedidoCompleto(s.ronda.pedidos[1]), true);
  assert.equal(rondaCompleta(s.ronda), true);
});

/* ---------------------------------------------------------------- *
 * FR-019 / FR-020 — cierre de pedido y de ronda
 * ---------------------------------------------------------------- */

test('transicionDePedido detecta el pedido que acaba de cerrarse y el siguiente', () => {
  // Solo el 100001 avanza, y queda a una pieza de cerrarse.
  const base = estadoInicial();
  const casi = {
    ronda: {
      ...base.ronda,
      pedidos: base.ronda.pedidos.map((p) =>
        p.id !== '100001'
          ? p
          : {
              ...p,
              partidas: p.partidas.map((x) =>
                x.codigo === '2389475' ? { ...x, surtido: x.solicitado - 1 } : { ...x, surtido: x.solicitado },
              ),
            },
      ),
    },
  };
  const despues = surtir(casi, '2389475', 1);
  const t = transicionDePedido(casi.ronda, despues.ronda);
  assert.ok(t, 'debe detectar la transición');
  assert.equal(t.completado.id, '100001');
  assert.equal(t.siguiente.id, '100002');
});

test('al cerrarse el último pedido pendiente, la transición no apunta a ninguno', () => {
  const casi = completarTodo(estadoInicial(), (x, p) => p.id === '100003' && x.codigo === '3310500');
  const despues = surtir(casi, '3310500', 1);
  const t = transicionDePedido(casi.ronda, despues.ronda);
  assert.equal(t.completado.id, '100003');
  assert.equal(t.siguiente, null);
  assert.equal(rondaCompleta(despues.ronda), true);
});

test('no hay transición cuando el pedido queda con partidas parciales', () => {
  const antes = estadoInicial();
  const despues = surtir(antes, '0486600', 5);
  assert.equal(transicionDePedido(antes.ronda, despues.ronda), null);
});

test('la ronda se cierra solo cuando todos los pedidos están resueltos', () => {
  const inicial = estadoInicial();
  assert.equal(rondaCompleta(inicial.ronda), false);
  assert.equal(rondaCompleta(completarTodo(inicial).ronda), true);
});

/* ---------------------------------------------------------------- *
 * Stepper del detalle y reinicio
 * ---------------------------------------------------------------- */

test('fijarSurtido establece la cantidad absoluta de la partida indicada', () => {
  const s = rondaReducer(estadoInicial(), { type: 'fijarSurtido', pedidoId: '100002', codigo: '0486600', cantidad: 3 });
  assert.equal(partida(s, '100002', '0486600').surtido, 3);
  assert.equal(partida(s, '100001', '0486600').surtido, 0);
});

test('fijarSurtido ignora cantidades que exceden lo solicitado o la existencia', () => {
  const inicial = estadoInicial();
  assert.deepEqual(rondaReducer(inicial, { type: 'fijarSurtido', pedidoId: '100001', codigo: '0486600', cantidad: 99 }), inicial);
  assert.deepEqual(rondaReducer(inicial, { type: 'fijarSurtido', pedidoId: '100002', codigo: '0512300', cantidad: 2 }), inicial);
});

test('reiniciar devuelve la ronda a su estado original', () => {
  const avanzado = surtir(estadoInicial(), '0486600', 11);
  assert.deepEqual(rondaReducer(avanzado, { type: 'reiniciar' }), estadoInicial());
});

test('el estado inicial no comparte partidas con el mock entre llamadas', () => {
  const a = surtir(estadoInicial(), '0486600', 11);
  assert.equal(partida(a, '100001', '0486600').surtido, 11);
  assert.equal(partida(estadoInicial(), '100001', '0486600').surtido, 0);
});
