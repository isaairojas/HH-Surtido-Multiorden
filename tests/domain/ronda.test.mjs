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
  cambioDePedido,
  conteosRonda,
  MOTIVO_PROMOCION,
  estadoInicial,
  estadoPartida,
  evaluarSurtido,
  pedidoCompleto,
  partidasANegar,
  productosVista,
  productoVista,
  promocionesPendientes,
  proximaPartidaPara,
  rondaCompleta,
  rondaFinalizable,
  rondaReducer,
  statusProducto,
  transicionDePedido,
  ordenarPorFamilia,
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
  // 1394010 vive en 100001 (11 piezas) y en 100002 (5 piezas), ambos sin avance.
  const s = surtir(estadoInicial(), '1394010', 11);
  assert.equal(partida(s, '100001', '1394010').surtido, 11);
  assert.equal(partida(s, '100002', '1394010').surtido, 0);
});

test('con el primer pedido ya completo, el escaneo pasa al siguiente', () => {
  const s = surtir(surtir(estadoInicial(), '1394010', 11), '1394010', 3);
  assert.equal(partida(s, '100001', '1394010').surtido, 11);
  assert.equal(partida(s, '100002', '1394010').surtido, 3);
});

test('proximaPartidaPara salta las partidas ya resueltas', () => {
  const s = surtir(estadoInicial(), '1394010', 11);
  const loc = proximaPartidaPara(s.ronda, '1394010');
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
  const ev = evaluarSurtido(lleno.ronda, '1394010', 1);
  assert.equal(ev.ok, false);
  assert.equal(ev.rechazo, 'fuera-de-ronda');
});

test('cantidad cero se rechaza', () => {
  const inicial = estadoInicial();
  assert.equal(evaluarSurtido(inicial.ronda, '1394010', 0).rechazo, 'cantidad-cero');
  assert.deepEqual(surtir(inicial, '1394010', 0), inicial);
});

test('una cantidad mayor a la solicitada se rechaza entera, sin aplicar el remanente', () => {
  // Decisión 2026-10-21: gana la regla de Revision-HH-v2 sobre el edge case de la spec.
  const inicial = estadoInicial();
  const ev = evaluarSurtido(inicial.ronda, '1394010', 12); // solicita 11 en el 100001
  assert.equal(ev.ok, false);
  assert.equal(ev.rechazo, 'excede-solicitado');
  assert.equal(partida(surtir(inicial, '1394010', 12), '100001', '1394010').surtido, 0);
});

test('una cantidad mayor a la existencia se rechaza', () => {
  // 6200404 pide 2 piezas pero solo hay 1 en existencia.
  const inicial = estadoInicial();
  const ev = evaluarSurtido(inicial.ronda, '6200404', 2);
  assert.equal(ev.ok, false);
  assert.equal(ev.rechazo, 'excede-existencia');
  // Una pieza sí entra.
  assert.equal(evaluarSurtido(inicial.ronda, '6200404', 1).ok, true);
});

/* ---------------------------------------------------------------- *
 * FR-005 / FR-006 — vista agregada por código
 * ---------------------------------------------------------------- */

test('la vista agrupa cada código una sola vez y suma los totales de la ronda', () => {
  const v = productosVista(estadoInicial().ronda);
  const codigos = v.map((x) => x.codigo);
  assert.equal(new Set(codigos).size, codigos.length, 'no debe repetirse ningún código');

  const cinta = v.find((x) => x.codigo === '1394010');
  assert.equal(cinta.presencias.length, 3);
  assert.equal(cinta.solicitadoTotal, 19); // 11 + 5 + 3
  assert.deepEqual(
    cinta.presencias.map((p) => p.pedidoId),
    ['100001', '100002', '100003'],
    'las presencias respetan el orden de picking',
  );
});

test('el orden de la lista respeta la secuencia de picking', () => {
  const codigos = productosVista(estadoInicial().ronda).map((x) => x.codigo);
  assert.equal(codigos[0], '1394010', 'primera partida del primer pedido');
  assert.ok(codigos.indexOf('2012000') > codigos.indexOf('6200401'), 'el 100002 va después del 100001');
});

test('el status consolidado sigue pendiente mientras alguna presencia lo esté', () => {
  const s = surtir(estadoInicial(), '1394010', 11); // completo en 100001, intacto en 100002
  assert.equal(statusProducto(productoVista(s.ronda, '1394010')), 'parcial');
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
  const s = negar(estadoInicial(), '1394010');
  assert.equal(partida(s, '100001', '1394010').motivoNegacion, 'Sin existencia');
  assert.equal(partida(s, '100002', '1394010').motivoNegacion, 'Sin existencia');
  assert.equal(proximaPartidaPara(s.ronda, '1394010'), null, 'ya ningún pedido recibe el código');
});

test('negar con el primer pedido ya surtido empieza en el siguiente y respeta lo surtido', () => {
  // 2012000 pide 3 en el 100002 y 2 en el 100003: se completa el 100002.
  let s = surtir(estadoInicial(), '2012000', 3);
  s = negar(s, '2012000');
  assert.equal(estadoPartida(partida(s, '100002', '2012000')), 'completo');
  assert.equal(estadoPartida(partida(s, '100003', '2012000')), 'negado');
});

test('negar con avance parcial retira lo surtido: no existe la negación parcial', () => {
  let s = surtir(estadoInicial(), '1394010', 4);
  s = negar(s, '1394010');
  const p = partida(s, '100001', '1394010');
  assert.equal(p.surtido, 0);
  assert.equal(estadoPartida(p), 'negado');
});

test('partidasANegar lista los pedidos afectados con lo que se retira', () => {
  const s = surtir(estadoInicial(), '1394010', 4);
  const afectadas = partidasANegar(s.ronda, '1394010').map(({ pedidoId, surtido, solicitado }) => ({ pedidoId, surtido, solicitado }));
  assert.deepEqual(afectadas, [
    { pedidoId: '100001', surtido: 4, solicitado: 11 },
    { pedidoId: '100002', surtido: 0, solicitado: 5 },
    { pedidoId: '100003', surtido: 0, solicitado: 3 },
  ]);
});

test('sin pedidos que necesiten el código no hay nada que negar', () => {
  const s = completarTodo(estadoInicial());
  assert.deepEqual(partidasANegar(s.ronda, '1394010'), []);
  assert.deepEqual(negar(s, '1394010'), s);
});

test('un pedido con una partida negada se considera resuelto', () => {
  // El 100002 queda completo salvo 6200404, que se niega por falta de existencia.
  let s = completarTodo(estadoInicial(), (x) => x.codigo === '6200404');
  assert.equal(pedidoCompleto(s.ronda.pedidos[1]), false);
  s = rondaReducer(s, { type: 'negar', codigo: '6200404', motivo: 'Sin existencia' });
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
                x.codigo === '6200401' ? { ...x, surtido: x.solicitado - 1 } : { ...x, surtido: x.solicitado },
              ),
            },
      ),
    },
  };
  const despues = surtir(casi, '6200401', 1);
  const t = transicionDePedido(casi.ronda, despues.ronda);
  assert.ok(t, 'debe detectar la transición');
  assert.equal(t.completado.id, '100001');
  assert.equal(t.siguiente.id, '100002');
});

test('al cerrarse el último pedido pendiente, la transición no apunta a ninguno', () => {
  const casi = completarTodo(estadoInicial(), (x, p) => p.id === '100003' && x.codigo === '2010000');
  const despues = surtir(casi, '2010000', 1);
  const t = transicionDePedido(casi.ronda, despues.ronda);
  assert.equal(t.completado.id, '100003');
  assert.equal(t.siguiente, null);
  assert.equal(rondaCompleta(despues.ronda), true);
});

test('no hay transición cuando el pedido queda con partidas parciales', () => {
  const antes = estadoInicial();
  const despues = surtir(antes, '1394010', 5);
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
  const s = rondaReducer(estadoInicial(), { type: 'fijarSurtido', pedidoId: '100002', codigo: '1394010', cantidad: 3 });
  assert.equal(partida(s, '100002', '1394010').surtido, 3);
  assert.equal(partida(s, '100001', '1394010').surtido, 0);
});

test('fijarSurtido ignora cantidades que exceden lo solicitado o la existencia', () => {
  const inicial = estadoInicial();
  assert.deepEqual(rondaReducer(inicial, { type: 'fijarSurtido', pedidoId: '100001', codigo: '1394010', cantidad: 99 }), inicial);
  assert.deepEqual(rondaReducer(inicial, { type: 'fijarSurtido', pedidoId: '100002', codigo: '6200404', cantidad: 2 }), inicial);
});

test('reiniciar devuelve la ronda a su estado original', () => {
  const avanzado = surtir(estadoInicial(), '1394010', 11);
  assert.deepEqual(rondaReducer(avanzado, { type: 'reiniciar' }), estadoInicial());
});

test('el estado inicial no comparte partidas con el mock entre llamadas', () => {
  const a = surtir(estadoInicial(), '1394010', 11);
  assert.equal(partida(a, '100001', '1394010').surtido, 11);
  assert.equal(partida(estadoInicial(), '100001', '1394010').surtido, 0);
});

/* ---------------------------------------------------------------- *
 * SDD multiorden-surtido-listado · Avisos de cambio de pedido
 * ---------------------------------------------------------------- */

test('cambioDePedido detecta cuando las siguientes piezas del código van a otro pedido', () => {
  const antes = surtir(estadoInicial(), '1394010', 10);
  const despues = surtir(antes, '1394010', 1);
  const c = cambioDePedido(antes.ronda, despues.ronda, '1394010');
  assert.equal(c.desde.id, '100001');
  assert.equal(c.hacia.id, '100002');
  assert.equal(c.ordenHacia, 1);
});

test('sin cambio de destino, o sin destino, no hay aviso', () => {
  const antes = estadoInicial();
  const despues = surtir(antes, '1394010', 4);
  assert.equal(cambioDePedido(antes.ronda, despues.ronda, '1394010'), null, 'sigue en el 100001');
  // 1978000 solo vive en el 100003: al completarse no hay a dónde pasar.
  const solo = surtir(antes, '1978000', 1);
  assert.equal(cambioDePedido(antes.ronda, solo.ronda, '1978000'), null);
});

/* ---------------------------------------------------------------- *
 * SDD multiorden-surtido-listado · Promoción incompleta al finalizar la ronda
 * ---------------------------------------------------------------- */

/** Todo surtido salvo el limpiador del 100002, negada: su "Kit mantenimiento" queda incompleto. */
function conPromocionIncompleta() {
  const s = completarTodo(estadoInicial(), (x, p) => p.id === '100002' && x.codigo === '6200401');
  return rondaReducer(s, { type: 'negar', codigo: '6200401', motivo: 'Sin existencia' });
}

test('una promoción completa en el primer pedido e incompleta en el segundo solo lista el segundo', () => {
  const s = conPromocionIncompleta();
  assert.equal(partida(s, '100001', '6200401').surtido, 8, 'el 100001 conserva su limpiador');
  const pend = promocionesPendientes(s.ronda);
  assert.equal(pend.length, 1);
  assert.equal(pend[0].promocion.id, 'PROMO-MANTTO');
  assert.deepEqual(pend[0].pedidos.map((p) => p.pedidoId), ['100002']);
});

test('con una promoción incompleta la ronda está resuelta pero no se puede finalizar', () => {
  const s = conPromocionIncompleta();
  assert.equal(rondaCompleta(s.ronda), true);
  assert.equal(rondaFinalizable(s.ronda), false);
});

test('una promoción sin iniciar no está pendiente (la detiene el surtido, no la promoción)', () => {
  assert.deepEqual(promocionesPendientes(estadoInicial().ronda), []);
});

test('negar la promoción retira lo surtido solo en los pedidos donde quedó incompleta', () => {
  const s = rondaReducer(conPromocionIncompleta(), { type: 'negarPromocion', promocionId: 'PROMO-MANTTO' });
  const cinta = partida(s, '100002', '1394010');
  assert.equal(cinta.surtido, 0);
  assert.equal(cinta.motivoNegacion, MOTIVO_PROMOCION);
  assert.equal(partida(s, '100002', '6200401').motivoNegacion, 'Sin existencia', 'lo ya negado conserva su motivo');
  assert.equal(partida(s, '100001', '1394010').surtido, 11, 'el 100001 completó la promoción');
  assert.equal(partida(s, '100003', '1394010').surtido, 3, 'la cinta sin promoción no se toca');
  assert.equal(rondaFinalizable(s.ronda), true);
});

test('negar una promoción que no está pendiente no cambia nada', () => {
  const s = conPromocionIncompleta();
  const negada = rondaReducer(s, { type: 'negarPromocion', promocionId: 'PROMO-MANTTO' });
  assert.deepEqual(rondaReducer(negada, { type: 'negarPromocion', promocionId: 'PROMO-MANTTO' }), negada);
});

/* ---------------------------------------------------------------- *
 * SDD surtido-listado-imagen-familia — agrupación por familia
 * ---------------------------------------------------------------- */

test('la agrupación por familia ordena las familias alfabéticamente', () => {
  const v = ordenarPorFamilia(productosVista(estadoInicial().ronda));
  const familias = v.map((x) => x.familia);
  // Cada familia aparece en un solo bloque contiguo…
  const bloques = familias.filter((f, i) => f !== familias[i - 1]);
  assert.equal(new Set(bloques).size, bloques.length, 'una familia no debe quedar partida');
  // …y los bloques van en orden alfabético.
  assert.deepEqual(bloques, ['Bomba gasolina', 'Cinta', 'Foco', 'Limpiador', 'Relevador']);
});

test('dentro de una familia se conserva la secuencia de picking', () => {
  const base = productosVista(estadoInicial().ronda);
  const focosAntes = base.filter((x) => x.familia === 'Foco').map((x) => x.codigo);
  const focosDespues = ordenarPorFamilia(base).filter((x) => x.familia === 'Foco').map((x) => x.codigo);
  assert.deepEqual(focosDespues, focosAntes);
  assert.deepEqual(focosDespues, ['2012000', '1978000', '2010000']);
});

